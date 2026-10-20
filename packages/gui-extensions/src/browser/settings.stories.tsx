import { Button } from "@opencode/ui/button"
import { createStore } from "solid-js/store"
import { ExtensionContext, useExtension, type IpcClient } from "../sdk"
import { BrowserSettings } from "./settings-ipc"
import type { CookiePreferences } from "./preferences"
import CookieSettings from "./settings"

function Fixture() {
  const context = useExtension()
  const [preferences, setPreferences] = createStore<CookiePreferences>({ default: "project", projects: [] })
  const [mode, setMode] = createStore({ fail: false, unavailable: false, project: "project-a" })

  const client: IpcClient<typeof BrowserSettings.spec> = {
    state: () => preferences,
    on: () => () => undefined,
    default: async (input) => {
      if (mode.fail) throw new Error("Fixture save failure")

      setPreferences("default", input.scope)
    },
    project: async (input) => {
      if (mode.fail) throw new Error("Fixture save failure")

      setPreferences("projects", [
        ...preferences.projects.filter((item) => item.server !== input.server || item.project !== input.project),
        ...input.scope === "inherit" ? [] : [input],
      ])
    },
  }

  // SAFETY: the production component reads only settings.load; it receives the real typed IPC client stub here.
  const stub = {
    ...context,
    uses: {
      settings: {
        load: () => () => mode.unavailable
          ? { status: "inactive" as const, reason: "disabled" as const }
          : { status: "active" as const, generation: 1, value: client },
      },
    },
  }

  return (
    <ExtensionContext.Provider value={stub}>
      <div style={{ "max-width": "900px", margin: "0 auto", padding: "24px" }}>
        <h2 class="settings-tab-title">Browser cookie settings playground</h2>
        <p style={{ "margin-block": "12px", "line-height": "20px" }}>Real settings component, stubbed storage. No cookies or server connection.</p>
        <div style={{ display: "flex", gap: "8px", "flex-wrap": "wrap", "margin-bottom": "24px" }}>
          <Button onClick={() => setMode("fail", !mode.fail)}>Save errors: {mode.fail ? "on" : "off"}</Button>
          <Button onClick={() => setMode("unavailable", !mode.unavailable)}>IPC: {mode.unavailable ? "unavailable" : "available"}</Button>
          <Button onClick={() => setMode("project", mode.project === "project-a" ? "project-b" : "project-a")}>Switch project</Button>
          <Button onClick={() => { setPreferences({ default: "project", projects: [] }); setMode({ fail: false, unavailable: false, project: "project-a" }) }}>Reset</Button>
        </div>
        <h3 class="settings-section-title">App General</h3>
        <div class="settings-list"><CookieSettings /></div>
        <h3 class="settings-section-title" style={{ "margin-top": "24px" }}>Project General — {mode.project}</h3>
        <div class="settings-list"><CookieSettings project={{ server: "fixture-server", id: mode.project }} /></div>
        <pre style={{ "margin-top": "24px", "white-space": "pre-wrap" }}>{JSON.stringify(preferences, null, 2)}</pre>
      </div>
    </ExtensionContext.Provider>
  )
}

export default { title: "GUI Extensions/Browser/Cookie settings", component: Fixture }

export const Playground = {}
