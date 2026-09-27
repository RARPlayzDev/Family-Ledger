<#
.SYNOPSIS
    Prints the SHA-256 signing fingerprint that Android App Links verification
    needs for this app.

.DESCRIPTION
    /.well-known/assetlinks.json must list the certificate your release build is
    signed with, otherwise tapping a FamilyLedger link opens the browser instead
    of the app.

    Run this against whichever keystore you ship with, then paste the printed
    value into:
        public/.well-known/assetlinks.json  ->  sha256_cert_fingerprints

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\print-signing-fingerprint.ps1 `
        -Keystore C:\keys\familyledger-release.jks -Alias familyledger

.EXAMPLE
    # The debug keystore Android Studio generates on this machine, which is what
    # a debug build is signed with:
    powershell -ExecutionPolicy Bypass -File tools\print-signing-fingerprint.ps1 `
        -Keystore "$env:USERPROFILE\.android\debug.keystore" -Alias androiddebugkey `
        -StorePass android
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $Keystore,

    [Parameter(Mandatory = $true)]
    [string] $Alias,

    [string] $StorePass,

    [string] $Keytool = 'keytool'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Keystore)) {
    throw "Keystore not found: $Keystore"
}

$arguments = @('-list', '-v', '-keystore', $Keystore, '-alias', $Alias)
if ($StorePass) { $arguments += @('-storepass', $StorePass) }

$output = & $Keytool @arguments 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Error "keytool failed:`n$output"
}

# keytool wraps the long fingerprint across two lines; rejoin it.
$fingerprint = ($output -split "`r?`n" |
    Where-Object { $_ -match 'SHA256:' } |
    Select-Object -First 1) -replace '.*SHA256:\s*', '' -replace '\s', ''

if (-not $fingerprint) {
    throw "No SHA256 fingerprint found for alias '$Alias' in $Keystore."
}

Write-Host ''
Write-Host "Alias       : $Alias"
Write-Host "SHA-256     : $fingerprint"
Write-Host ''
Write-Host 'Paste it into public/.well-known/assetlinks.json -> sha256_cert_fingerprints[0]'
Write-Host 'Then redeploy, and reinstall the app so Android re-runs verification:'
Write-Host '    adb shell pm verify-app-links --re-verify com.example.familyledger'
Write-Host ''
