import { Schema } from "effect"

export const CookieScope = Schema.Literals(["temporary", "session", "project", "global"])

export type CookieScope = typeof CookieScope.Type

export const ProjectCookieScope = Schema.Literals(["inherit", "temporary", "session", "project"])

export const CookiePreferences = Schema.Struct({
  default: CookieScope,
  projects: Schema.Array(
    Schema.Struct({ server: Schema.String, project: Schema.String, scope: ProjectCookieScope }),
  ),
})

export type CookiePreferences = typeof CookiePreferences.Type

/** Server identity is part of session/project scope; remote projects must not inherit local logins. */
export function cookieScopeKey(preferences: CookiePreferences, server: string, project: string, session: string) {
  const override = preferences.projects.find((item) => item.server === server && item.project === project)?.scope
  const scope = override && override !== "inherit" ? override : preferences.default

  if (scope === "temporary") return undefined

  if (scope === "global") return "global"

  return JSON.stringify(scope === "session" ? [scope, server, session] : [scope, server, project])
}
