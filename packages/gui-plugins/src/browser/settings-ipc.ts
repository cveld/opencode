import { Schema } from "effect"
import { Ipc } from "@opencode/plugin/gui"
import { CookiePreferences, CookieScope, ProjectCookieScope } from "./preferences"

export const BrowserSettings = Ipc.define({
  id: "browser.settings",
  state: CookiePreferences,
  methods: {
    default: { input: Schema.Struct({ scope: CookieScope }) },
    project: {
      input: Schema.Struct({ server: Schema.String, project: Schema.String, scope: ProjectCookieScope }),
    },
  },
})
