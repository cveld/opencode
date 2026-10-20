import { safeStorage, session, type Cookie } from "electron"
import { Schema } from "effect"
import type { Storage } from "../sdk/main"

const StoredCookie = Schema.Struct({
  name: Schema.String,
  value: Schema.String,
  domain: Schema.String,
  path: Schema.String,
  secure: Schema.Boolean,
  httpOnly: Schema.Boolean,
  hostOnly: Schema.Boolean,
  sameSite: Schema.Literals(["unspecified", "no_restriction", "lax", "strict"]),
  expirationDate: Schema.optionalKey(Schema.Finite),
})

type StoredCookie = typeof StoredCookie.Type

const Cookies = Schema.Array(StoredCookie)

/** Encrypted cookie jars, independent of the per-attachment Chromium profile and proxy. */
export function createCookieStore(storage: Storage) {
  const jars = new Map<string, {
    cookies: Map<string, StoredCookie>
    peers: Set<ReturnType<typeof session.fromPartition>>
    echoes: Map<ReturnType<typeof session.fromPartition>, Map<string, number>>
    pending: Promise<void>
    save: () => void
  }>()

  return {
    async attach(key: string, partition: string, signal: AbortSignal) {
      // Never fall back to plaintext storage for authenticated cookies.
      if (!safeStorage.isEncryptionAvailable() ||
          (process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text"))
        throw new Error("Secure cookie storage is unavailable. Select non-persistent browser sessions or enable your OS keyring.")

      const stored = storage.store(`cookies:${key}`, { schema: Schema.String, initial: "" })
      const existing = jars.get(key)

      const cookies = existing?.cookies ?? new Map(
        (stored.value
          ? Schema.decodeUnknownSync(Schema.fromJsonString(Cookies))(
              safeStorage.decryptString(Buffer.from(stored.value, "base64")),
            )
          : []).flatMap((cookie) => expired(cookie) ? [] : [[identity(cookie), cookie] as const]),
      )

      const jar = existing ?? {
        cookies,
        peers: new Set<ReturnType<typeof session.fromPartition>>(),
        echoes: new Map<ReturnType<typeof session.fromPartition>, Map<string, number>>(),
        pending: Promise.resolve(),
        save: () => stored.set(safeStorage.encryptString(JSON.stringify(Array.from(cookies.values()))).toString("base64")),
      }

      jars.set(key, jar)
      const peer = session.fromPartition(partition)

      // Serialize hydration with updates from already attached sessions before any page can load.
      const ready = jar.pending.then(async () => {
        await Promise.all(Array.from(jar.cookies.values()).flatMap((cookie) =>
          expired(cookie) ? [] : [peer.cookies.set(details(cookie))],
        ))

        if (signal.aborted) throw new Error("Browser cookie attachment was cancelled.")

        jar.peers.add(peer)
        peer.cookies.on("changed", changed)
      })

      jar.pending = ready.catch(() => undefined)
      await ready

      function changed(_event: Electron.Event, cookie: Cookie, cause: string, removed: boolean) {
        // Chromium reports removal of the old value before an overwrite's insertion.
        if (removed && cause === "overwrite") return

        const next = fromCookie(cookie)
        const id = identity(next)
        const echo = JSON.stringify(removed ? [id, true] : [next, false])
        const expected = jar.echoes.get(peer)
        const count = expected?.get(echo) ?? 0

        if (count > 0) {
          if (count === 1) expected?.delete(echo)

          if (count > 1) expected?.set(echo, count - 1)

          return
        }

        const current = jar.cookies.get(id)

        // Setting a peer cookie emits another changed event. Identical values are synchronization echoes.
        if (removed ? !current : JSON.stringify(current) === JSON.stringify(next)) return

        if (removed) jar.cookies.delete(id)

        if (!removed) jar.cookies.set(id, next)

        jar.save()
        jar.pending = jar.pending.then(async () => {
          const latest = jar.cookies.get(id)
          await Promise.all(Array.from(jar.peers, (other) => {
            const expected = jar.echoes.get(other) ?? new Map<string, number>()
            const echo = JSON.stringify(latest ? [latest, false] : [id, true])
            expected.set(echo, (expected.get(echo) ?? 0) + 1)
            jar.echoes.set(other, expected)

            return (latest ? other.cookies.set(details(latest)) : other.cookies.remove(url(next), next.name))
              .finally(() => expected.delete(echo))
          }))
        }).catch(() => {
          // Do not log cookie values. A failed synchronization must not silently leave a stale login active.
          jar.peers.forEach((other) => {
            if (other !== peer) void other.cookies.remove(url(next), next.name).catch(() => undefined)
          })
        })
      }

      return async () => {
        peer.cookies.off("changed", changed)
        jar.peers.delete(peer)
        jar.echoes.delete(peer)
        await jar.pending
      }
    },
    async dispose() {
      await Promise.all(Array.from(jars.values(), (jar) => jar.pending))
      jars.clear()
    },
  }
}

function fromCookie(cookie: Cookie): StoredCookie {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain ?? "",
    path: cookie.path ?? "/",
    secure: cookie.secure ?? false,
    httpOnly: cookie.httpOnly ?? false,
    hostOnly: cookie.hostOnly ?? true,
    sameSite: cookie.sameSite,
    expirationDate: cookie.expirationDate,
  }
}

function identity(cookie: StoredCookie) {
  return JSON.stringify([cookie.domain, cookie.path, cookie.name])
}

function expired(cookie: StoredCookie) {
  return cookie.expirationDate !== undefined && cookie.expirationDate <= Date.now() / 1_000
}

function url(cookie: StoredCookie) {
  return `${cookie.secure ? "https" : "http"}://${cookie.domain.replace(/^\./, "")}${cookie.path}`
}

function details(cookie: StoredCookie) {
  return { ...cookie, url: url(cookie), domain: cookie.hostOnly ? undefined : cookie.domain }
}
