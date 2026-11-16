# Run explicitly with PowerShell 7. Creates a user-trusted certificate for this local development runtime only.
# Do not use this certificate for distribution or export its private key.
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'Run this script with pwsh (PowerShell 7).' }
$root = Split-Path $PSScriptRoot -Parent
$desktop = Join-Path $root 'packages/desktop'
$directory = Join-Path $root '.cache/slot1-signed-electron'
$subject = 'CN=OpenCode Slot 1 Local Development'

Push-Location $desktop
try {
    # Never modify the package-manager-owned Electron binary.
    Remove-Item Env:ELECTRON_OVERRIDE_DIST_PATH -ErrorAction SilentlyContinue
    $source = node -p "require('electron')" | Select-Object -Last 1
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $source)) { throw 'Install Electron dependencies first.' }
    $hash = (Get-FileHash $source -Algorithm SHA256).Hash
    $certificate = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object {
        $_.Subject -eq $subject -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date).AddDays(30)
    } | Sort-Object NotAfter -Descending | Select-Object -First 1
    if (-not $certificate) {
        $certificate = New-SelfSignedCertificate -Type CodeSigningCert -Subject $subject `
            -CertStoreLocation Cert:\CurrentUser\My -KeyExportPolicy NonExportable `
            -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(1)
    }
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $public = Join-Path $directory 'slot1-development.cer'
    Export-Certificate -Cert $certificate -FilePath $public -Force | Out-Null
    foreach ($store in @('Cert:\CurrentUser\Root', 'Cert:\CurrentUser\TrustedPublisher')) {
        if (-not (Test-Path "$store\$($certificate.Thumbprint)")) {
            Import-Certificate -FilePath $public -CertStoreLocation $store | Out-Null
        }
    }
    Copy-Item (Join-Path (Split-Path $source) '*') $directory -Recurse -Force
    $executable = Join-Path $directory (Split-Path $source -Leaf)
    $signature = Set-AuthenticodeSignature -FilePath $executable -Certificate $certificate -HashAlgorithm SHA256
    if ($signature.Status -ne 'Valid') { throw "Signing failed: $($signature.Status) $($signature.StatusMessage)" }
    @{
        sourceHash = $hash
        thumbprint = $certificate.Thumbprint
        executable = $executable
    } | ConvertTo-Json | Set-Content (Join-Path $directory 'runtime.json')
    Write-Host "Signed slot 1 runtime ready: $executable"
    Write-Host "Development certificate: $($certificate.Thumbprint), expires $($certificate.NotAfter)"
} finally {
    Pop-Location
}
