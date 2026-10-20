import { Select } from "@opencode/ui/select"
import { Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useExtension } from "../sdk"
import type definition from "./index"
import { BrowserSettings } from "./settings-ipc"
import type { CookieScope } from "./preferences"

export default function CookieSettings(props: { project?: { server: string; id: string } }) {
  const ctx = useExtension<typeof definition>()
  const settings = ctx.uses.settings.load(BrowserSettings)
  const [status, setStatus] = createStore({ saving: false, failed: false })

  const active = () => {
    const current = settings()

    return current.status === "active" ? current.value : undefined
  }

  const value = () => {
    const state = active()?.state()

    if (!props.project) return state?.default ?? "project"

    return state?.projects.find((item) => item.server === props.project?.server && item.project === props.project.id)?.scope ?? "inherit"
  }

  const options = () => props.project
    ? ["inherit", "temporary", "session", "project"] as const
    : ["temporary", "session", "project", "global"] as const

  const label = (scope: CookieScope | "inherit") => ctx.t(`settings.cookies.${scope}`)

  return (
    <div data-component="settings-row" data-action="browser-cookie-scope">
      <div data-slot="settings-row-copy">
        <div data-slot="settings-row-title">{ctx.t("settings.cookies.title")}</div>
        <div data-slot="settings-row-description">{ctx.t("settings.cookies.description")}</div>
      </div>
      <div data-slot="settings-row-control">
        <Show when={active()?.state()} fallback={<span>{ctx.t("settings.cookies.unavailable")}</span>}>
          <Select
            disabled={status.saving}
            options={[...options()]}
            current={value()}
            label={label}
            value={(scope) => scope}
            onSelect={async (scope) => {
              const client = active()

              if (!client || !scope) return

              const request = props.project && scope !== "global"
                ? client.project({ server: props.project.server, project: props.project.id, scope }, { signal: ctx.signal })
                : scope !== "inherit" ? client.default({ scope }, { signal: ctx.signal }) : undefined

              setStatus({ saving: true, failed: false })
              const failed = await request?.then(() => false, () => true)

              if (!ctx.signal.aborted) setStatus({ saving: false, failed: failed ?? false })
            }}
          />
          <Show when={status.failed}><span role="alert">{ctx.t("settings.cookies.failed")}</span></Show>
        </Show>
      </div>
    </div>
  )
}
