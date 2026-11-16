param()

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$desktop = Join-Path $root 'packages/desktop'

if ((git -C $root branch --show-current) -ne 'desktop-integration') {
    throw 'Switch to desktop-integration before starting this launcher.'
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
Remove-Item Env:OPENCODE_DESKTOP_CLI_DEV -ErrorAction SilentlyContinue
Remove-Item Env:OPENCODE_DESKTOP_SERVER_CHANNEL -ErrorAction SilentlyContinue
Remove-Item Env:VITE_OPENCODE_TEST_FIXTURES -ErrorAction SilentlyContinue
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

Push-Location $desktop
try {
    bun ./scripts/copy-icons.ts dev
    if ($LASTEXITCODE -ne 0) { throw 'Icon preparation failed.' }
    $electron = node -p "require.resolve('electron/install.js')"
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $electron)) {
        throw 'Run bun install --frozen-lockfile first.'
    }
    node $electron
    if ($LASTEXITCODE -ne 0) { throw 'Electron preparation failed.' }
    $manifest = Join-Path $root '.cache/slot1-signed-electron/runtime.json'
    if (-not (Test-Path $manifest)) {
        throw 'Prepare the signed slot 1 runtime first: pwsh -NoProfile -File script/prepare-slot1-signed-runtime.ps1'
    }
    $runtime = Get-Content $manifest -Raw | ConvertFrom-Json
    Remove-Item Env:ELECTRON_OVERRIDE_DIST_PATH -ErrorAction SilentlyContinue
    $source = node -p "require('electron')" | Select-Object -Last 1
    if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve the installed Electron runtime.' }
    # Use PowerShell 7 for Authenticode checks, even when PM2 launched Windows PowerShell.
    $check = '& { param($file, $thumbprint, $source, $hash) if ((Get-FileHash $source -Algorithm SHA256).Hash -ne $hash) { throw "Electron changed; rerun script/prepare-slot1-signed-runtime.ps1" }; $s = Get-AuthenticodeSignature $file; if ($s.Status -ne "Valid" -or $s.SignerCertificate.Thumbprint -ne $thumbprint) { throw "Invalid slot 1 runtime signature" } }'
    $command = "$check '$($runtime.executable.Replace("'", "''"))' '$($runtime.thumbprint)' '$($source.Replace("'", "''"))' '$($runtime.sourceHash)'"
    pwsh -NoProfile -EncodedCommand ([Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command)))
    if ($LASTEXITCODE -ne 0) { throw 'Signed slot 1 runtime validation failed.' }
    $env:ELECTRON_EXEC_PATH = $runtime.executable
    $env:ELECTRON_OVERRIDE_DIST_PATH = Split-Path $runtime.executable
    Write-Host "Starting desktop-integration against existing service $($info.version)."
    bunx --no-install electron-vite dev
    if ($LASTEXITCODE -ne 0) { throw 'Desktop exited with an error.' }
} finally {
    Pop-Location
}
