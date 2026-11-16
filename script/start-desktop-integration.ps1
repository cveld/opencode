param()

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$desktop = Join-Path $root 'packages/desktop'

if ((git -C $root branch --show-current) -ne 'desktop-integration-2') {
    throw 'Switch to desktop-integration-2 before starting this launcher.'
}

# Read-only API request through the installed CLI's authenticated service discovery.
$info = opencode api get /api/info | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $info.pid -or -not $info.version) {
    throw 'The existing OpenCode service must be running.'
}
$service = Get-CimInstance Win32_Process -Filter "ProcessId = $($info.pid)"
if (-not $service.ExecutablePath -or -not (Test-Path $service.ExecutablePath)) {
    throw 'Cannot locate the running service executable. No server will be started.'
}

$resources = Join-Path $desktop 'resources'
New-Item -ItemType Directory -Path $resources -Force | Out-Null
Copy-Item $service.ExecutablePath (Join-Path $resources 'opencode-cli.exe') -Force
Set-Content (Join-Path $resources 'opencode-cli.version') $info.version -NoNewline

# Local renderer, dev desktop profile, and the exact live server version.
# Do not use scripts/dev.ts: it defaults to an isolated source server.
$env:OPENCODE_CHANNEL = 'local'
$env:OPENCODE_VERSION = $info.version
$env:OPENCODE_DESKTOP_ISOLATED_SERVER = '0'
$env:OPENCODE_DESKTOP_USER_DATA = Join-Path $env:APPDATA 'ai.opencode.desktop.integration-2'
$env:OPENCODE_DESKTOP_REMOTE_DEBUGGING_PORT = '9223'
Remove-Item Env:OPENCODE_DESKTOP_TEST_ROOT -ErrorAction SilentlyContinue
Remove-Item Env:OPENCODE_DESKTOP_CLI_DEV -ErrorAction SilentlyContinue
Remove-Item Env:OPENCODE_DESKTOP_SERVER_CHANNEL -ErrorAction SilentlyContinue
Remove-Item Env:VITE_OPENCODE_TEST_FIXTURES -ErrorAction SilentlyContinue
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

Push-Location $desktop
try {
    bun ./script/copy-icons.ts dev
    if ($LASTEXITCODE -ne 0) { throw 'Icon preparation failed.' }
    $electron = node -p "require.resolve('electron/install.js')"
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $electron)) {
        throw 'Run bun install --frozen-lockfile first.'
    }
    node $electron
    if ($LASTEXITCODE -ne 0) { throw 'Electron preparation failed.' }
    Write-Host "Starting desktop-integration-2 against existing service $($info.version)."
    bunx --no-install electron-vite dev
    if ($LASTEXITCODE -ne 0) { throw 'Desktop exited with an error.' }
} finally {
    Pop-Location
}
