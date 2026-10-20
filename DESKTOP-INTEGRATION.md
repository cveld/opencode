# Local Desktop integration

Branch: `desktop-integration`. This is a local integration branch, not an upstream PR branch.

## Included changes

- PR #57358: keep local sessions in the selected directory (`a3c0fad9b`).

## Start on Windows

```powershell
pwsh -NoProfile -File .\script\start-desktop-integration.ps1
```

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
