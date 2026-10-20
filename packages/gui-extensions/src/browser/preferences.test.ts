import { expect, test } from "bun:test"
import { cookieScopeKey, type CookiePreferences } from "./preferences"

// Protects persisted jar identity: a scope regression could leak logins between unrelated servers/projects.
// Existing browser connection tests only cover tab inventory and do not select cookie jars.
test("cookie scopes share only the selected server/project/session boundary", () => {
  const preferences: CookiePreferences = { default: "project", projects: [] }
  expect(cookieScopeKey(preferences, "local", "repo", "session-a"))
    .toBe(cookieScopeKey(preferences, "local", "repo", "session-b"))
  expect(cookieScopeKey(preferences, "local", "repo", "session-a"))
    .not.toBe(cookieScopeKey(preferences, "remote", "repo", "session-a"))
  expect(cookieScopeKey(preferences, "local", "repo", "session-a"))
    .not.toBe(cookieScopeKey(preferences, "local", "other", "session-a"))
  expect(cookieScopeKey({ ...preferences, default: "session" }, "local", "repo", "session-a"))
    .not.toBe(cookieScopeKey({ ...preferences, default: "session" }, "local", "repo", "session-b"))
  expect(cookieScopeKey({ ...preferences, default: "temporary" }, "local", "repo", "session-a")).toBeUndefined()
  expect(cookieScopeKey({ ...preferences, default: "global" }, "local", "repo", "session-a"))
    .toBe(cookieScopeKey({ ...preferences, default: "global" }, "remote", "other", "session-b"))
})

test("project override can restrict a global default without affecting another project", () => {
  const preferences: CookiePreferences = {
    default: "global",
    projects: [{ server: "local", project: "repo", scope: "session" }],
  }

  expect(cookieScopeKey(preferences, "local", "repo", "session-a"))
    .toBe(JSON.stringify(["session", "local", "session-a"]))
  expect(cookieScopeKey(preferences, "remote", "repo", "session-a")).toBe("global")
  expect(cookieScopeKey(preferences, "local", "other", "session-a")).toBe("global")
  expect(cookieScopeKey({ ...preferences, projects: [{ server: "local", project: "repo", scope: "temporary" }] }, "local", "repo", "session-a"))
    .toBeUndefined()
  expect(cookieScopeKey({ ...preferences, projects: [{ server: "local", project: "repo", scope: "inherit" }] }, "local", "repo", "session-a"))
    .toBe("global")
})
