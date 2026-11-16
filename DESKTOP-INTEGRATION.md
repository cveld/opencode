# Local Desktop integration

Branch: `desktop-integration-2`. This is a local integration branch, not an upstream PR branch.

## Included changes

- PR #57358: keep local sessions in the selected directory (`a3c0fad9b`).

## Start on Windows

```powershell
pwsh -NoProfile -File .\script\start-desktop-integration.ps1
```

Or use the absolute path from any directory:

```powershell
pwsh -NoProfile -File "D:\git\github\anomalyco\opencode\desktop-integration-2\script\start-desktop-integration.ps1"
```

The PM2 entry `opencode-integration-2` invokes this same launcher. Start it through the clean-start script (`$pm2Dir` is the local PM2 configuration directory):

```powershell
& "$pm2Dir\start-clean.ps1" -Name opencode-integration-2
```

Slot 1 also has an explicit PM2 entry, `opencode-integration-1`, targeting the sibling `desktop-integration-1` worktree. Both slots are excluded from default all-app startup and from the reboot dump saved by `start-clean.ps1`; both disable automatic restart. Do not use a separate unfiltered `pm2 save` after launching them, as it can put them back into the reboot dump.

Slot 2 uses a separate `ai.opencode.desktop.integration-2` profile, renderer port `5175`, and debugging port `9223`. It discovers and copies the live service executable/version into its own resources; it does not depend on slot 1. The old Temp launcher forwards here for compatibility.

The launcher runs the local Electron renderer with the dev Desktop profile and connects to the already-running service. It copies that service's executable and version into ignored development resources so Desktop's version negotiation does not request an upgrade. It does not install or replace the normal Desktop app, copy its profile, or start the source server. The normal app can remain open. Existing sessions are available through the shared server, but tabs and Desktop preferences belong to the separate dev profile.

If the live service is stopped or upgraded during launch, stop and reassess; the Desktop service lifecycle can start or replace a server when no compatible service exists. This is not a hard read-only connection mode.

## Add another PR

Keep each fix on its own PR branch. Merge only approved PR branches into this integration branch and update the included changes above. For an upstream PR:

```powershell
git fetch origin pull/<number>/head
git merge --no-ff FETCH_HEAD
```

Do not merge the integration branch back into an individual PR branch. Commit integration-only launch changes separately. Upstream updates and additional PRs require another validation pass before relaunching.

Only client changes run locally here. Server PRs need a separate isolated-server setup. Closing the dev window or terminal returns you to the installed Desktop app; the installed service and session database are shared, not disposable test data.
