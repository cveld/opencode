# Local Desktop integration

Branch: `desktop-integration`. This is a local integration branch, not an upstream PR branch.

## Included changes

- PR #57358: keep local sessions in the selected directory (`a3c0fad9b`).

## Start on Windows

```powershell
pwsh -NoProfile -File .\script\start-desktop-integration.ps1
```

The repository root `D:\git\github\anomalyco\opencode` is now bare. Run the launcher from the slot 1 worktree, or use its absolute path:

```powershell
pwsh -NoProfile -File "D:\git\github\anomalyco\opencode\desktop-integration-1\script\start-desktop-integration.ps1"
```

Slot 1 can also start through its explicit PM2 entry (`$pm2Dir` is the local PM2 configuration directory):

```powershell
& "$pm2Dir\start-clean.ps1" -Name opencode-integration-1
```

Both integration slots are excluded from the default PM2 start and the reboot dump saved by `start-clean.ps1`, and have automatic restart disabled. A separate unfiltered `pm2 save` can put them back into the reboot dump; do not use it after launching integration slots.

Slot 2 remains in `desktop-integration-2` and starts through its explicit PM2 entry:

```powershell
& "$pm2Dir\start-clean.ps1" -Name opencode-integration-2
```

To start slot 2 directly in a terminal:

```powershell
pwsh -NoProfile -File "D:\git\github\anomalyco\opencode\desktop-integration-2\script\start-desktop-integration.ps1"
```

Both worktrees have their own launcher. Slot 2 uses the isolated `ai.opencode.desktop.integration-2` profile, renderer port `5175`, and debugging port `9223`. Its launcher discovers and copies the live service executable/version into its own resources, without depending on slot 1. The old Temp launcher forwards to the worktree launcher for compatibility.

The launcher runs the local Electron renderer with the dev Desktop profile and connects to the already-running service. It copies that service's executable and version into ignored development resources so Desktop's version negotiation does not request an upgrade. It does not install or replace the normal Desktop app, copy its profile, or start the source server. The normal app can remain open. Existing sessions are available through the shared server, but tabs and Desktop preferences belong to the separate dev profile.

If the live service is stopped or upgraded during launch, stop and reassess; the Desktop service lifecycle can start or replace a server when no compatible service exists. This is not a hard read-only connection mode.

## Browser pane enlargement

The browser toolbar has a maximize/restore button beside the element inspector. On desktop-width layouts it enlarges the selected side or split pane across the session workspace, without reloading the page or changing saved pane sizes. Mobile and bottom-pane renders do not expose this action. The native Desktop end-to-end enlargement remains to be verified; the browser component suite and full repository checks pass.

## Slot 1 signed development runtime

Slot 1 uses a private Electron runtime under `.cache/slot1-signed-electron`, not the package-manager-owned executable. Prepare it explicitly with PowerShell 7:

```powershell
pwsh -NoProfile -File .\script\prepare-slot1-signed-runtime.ps1
```

This creates a non-exportable, one-year code-signing certificate named `OpenCode Slot 1 Local Development` in `CurrentUser\My` and trusts its public certificate in `CurrentUser\Root` and `CurrentUser\TrustedPublisher`. It is for local development only, not distribution. Rerun preparation after an Electron update or certificate expiry; the launcher refuses a stale source hash or invalid signature. Slot 2 and the installed Desktop app are not signed or changed by this script.

The initial Windows WebAuthn provider probe with this signed Electron 44.9.1 runtime returned Windows Hello and 1Password (reported as locked). This proves native provider enumeration, not a completed embedded-browser passkey login. Entra user-agent capability detection still needs verification in the actual login flow.

To revoke this development certificate, remove only its thumbprint from the three CurrentUser stores above. The initial thumbprint is `DC389056577F9EC845FD2BE12CDE592A722C8AA4`; `runtime.json` records the current one. Do not remove unrelated certificates.

## Add another PR

Keep each fix on its own PR branch. Merge only approved PR branches into this integration branch and update the included changes above. For an upstream PR:

```powershell
git fetch origin pull/<number>/head
git merge --no-ff FETCH_HEAD
```

Do not merge the integration branch back into an individual PR branch. Commit integration-only launch changes separately. Upstream updates and additional PRs require another validation pass before relaunching.

Only client changes run locally here. Server PRs need a separate isolated-server setup. Closing the dev window or terminal returns you to the installed Desktop app; the installed service and session database are shared, not disposable test data.
