<#
.SYNOPSIS
  Build the TIA Portal Import VSIX from the compiled-only workspace and (optionally) overlay-install
  it into the running VS Code. Orchestrates the full build+install path from the tia-fork-sync skill.

.DESCRIPTION
  This workspace is compiled-only (no src/, no tsconfig.json). The standard `npm run package` runs
  vscode:prepublish -> `build:dotnet && compile`, which is unsafe here:
    - build:dotnet would overwrite the project-server-fixed DLL
    - compile (tsc) would fail: no tsconfig.json
  This script:

    BUILD (-BuildOnly or -Install):
    1. Stage node_modules/ by copying it from the installed extension (validated native binaries).
       Does NOT run npm install (which can pull incompatible natives). Verify with npm ls.
    2. Temporarily neutralize vscode:prepublish (set to an echo) so the build skips build:dotnet/
       compile/version-bump.
    3. npx @vscode/vsce package  -- WITHOUT --no-dependencies (which would drop node_modules and
       produce a VSIX that fails to load with 'Cannot find module').
    4. Restore vscode:prepublish to its original value.
    5. Hash the fixed-version DLL entries inside the VSIX against the workspace DLLs to confirm the
       fix shipped.

    INSTALL (-Install only, after build):
    6. Overlay the VSIX onto the installed extension folder via install-overlay.ps1 (rename-trick
       for locked files). Requires Developer: Reload Window afterward.

  See references/merge-strategy.md § "VSIX build" and § "Install".

.PARAMETER Workspace
  Repository root. Defaults to the script's grandparent x4.

.PARAMETER BuildOnly
  Build the VSIX but do not install it.

.PARAMETER Install
  Build the VSIX and overlay-install it.

.PARAMETER VsceVersion
  Version of @vscode/vsce to invoke via npx. Defaults to 3.7.1.

.EXAMPLE
  pwsh ./scripts/build-and-install.ps1 -BuildOnly
  pwsh ./scripts/build-and-install.ps1 -Install
#>
[CmdletBinding()]
param(
    [string]$Workspace,
    [switch]$BuildOnly,
    [switch]$Install,
    [string]$VsceVersion = '3.7.1'
)

$ErrorActionPreference = 'Stop'

if (-not $Workspace) {
    $Workspace = (Resolve-Path (Join-Path $PSScriptRoot '..' '..' '..' '..')).Path
}
if (-not $BuildOnly -and -not $Install) {
    Write-Host "No mode specified. Defaulting to -BuildOnly. Use -Install to also overlay-install." -ForegroundColor Yellow
    $BuildOnly = $true
}
Push-Location $Workspace
try {
    $pkgPath = Join-Path $Workspace 'package.json'
    if (-not (Test-Path $pkgPath)) { throw "No package.json in $Workspace" }
    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
    $version = $pkg.version
    $vsixName = "tia-import-$version.vsix"
    $vsixPath = Join-Path $Workspace $vsixName

    # --- Auto-detect installed extension (for node_modules + overlay) ----------
    $extRoot = Join-Path $env:USERPROFILE '.vscode\extensions'
    $cands = Get-ChildItem $extRoot -Directory -Filter 'mariuszczyrnek*tia-import-*' -ErrorAction SilentlyContinue
    if (-not $cands) { throw "No installed mariuszczyrnek...tia-import-* under $extRoot." }
    $installed = ($cands | Sort-Object { [version]($_.BaseName -replace '.*tia-import-', '') } -Descending | Select-Object -First 1).FullName

    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " TIA Portal Import - build (and install) VSIX" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " Workspace  : $Workspace"
    Write-Host " Version    : $version -> VSIX $vsixName"
    Write-Host " Installed  : $installed"
    Write-Host " Mode       : $(if ($Install) { 'BUILD + INSTALL' } else { 'BUILD ONLY' })"
    Write-Host ""

    # --- 1. Stage node_modules from installed ext ------------------------------
    $wsNm = Join-Path $Workspace 'node_modules'
    $instNm = Join-Path $installed 'node_modules'
    if (-not (Test-Path $instNm)) { throw "Installed extension has no node_modules at $instNm" }
    Write-Host "[1/5] Staging node_modules/ from installed extension (validated natives)..." -ForegroundColor Cyan
    if (Test-Path $wsNm) { Remove-Item $wsNm -Recurse -Force }
    robocopy $instNm $wsNm /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy node_modules failed (exit $LASTEXITCODE)" }
    Write-Host "      Copied. Verifying production dep tree..."
    & npm ls --production --depth=0 2>&1 | Select-String -Pattern 'tia-import|edge-js|electron-edge-js|xml2js|ERR|missing' | ForEach-Object { Write-Host "      $_" }
    if ($LASTEXITCODE -ne 0) { Write-Host "      WARN: npm ls exited $LASTEXITCODE (review above)." -ForegroundColor Yellow }

    # --- 2+3. Neutralize prepublish, build VSIX, restore prepublish ------------
    Write-Host "[2/5] Neutralizing vscode:prepublish for this build..." -ForegroundColor Cyan
    $originalPrepub = $pkg.scripts.'vscode:prepublish'
    if (-not $originalPrepub) { throw "package.json has no scripts.vscode:prepublish to neutralize." }
    $pkg.scripts.'vscode:prepublish' = 'echo "prepublish skipped (compiled-only workspace; out/ and dotnet DLLs are pre-built)"'
    ($pkg | ConvertTo-Json -Depth 20) | Set-Content $pkgPath -NoNewline
    try {
        Write-Host "[3/5] Building VSIX (npx @vscode/vsce@$VsceVersion package, WITH deps)..." -ForegroundColor Cyan
        & npx -y "@vscode/vsce@$VsceVersion" package 2>&1 | ForEach-Object { Write-Host "      $_" }
        if ($LASTEXITCODE -ne 0) { throw "vsce package failed (exit $LASTEXITCODE)" }
        if (-not (Test-Path $vsixPath)) { throw "VSIX not produced at $vsixPath" }
        $sz = [math]::Round((Get-Item $vsixPath).Length / 1MB, 2)
        Write-Host "      Built: $vsixName ($sz MB)" -ForegroundColor Green
    } finally {
        # ALWAYS restore prepublish, even on failure
        Write-Host "[4/5] Restoring vscode:prepublish..." -ForegroundColor Cyan
        $pkg2 = Get-Content $pkgPath -Raw | ConvertFrom-Json
        $pkg2.scripts.'vscode:prepublish' = $originalPrepub
        ($pkg2 | ConvertTo-Json -Depth 20) | Set-Content $pkgPath -NoNewline
    }

    # --- 5. Verify fixed-version DLLs are inside the VSIX ----------------------
    Write-Host "[5/5] Verifying fixed-version wrapper DLLs are inside the VSIX..." -ForegroundColor Cyan
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($vsixPath)
    try {
        foreach ($v in 'V18','V19','V20','V21') {
            $wsDll = Join-Path $Workspace "dotnet/TiaOpennessWrapper/bin/Release/net48/$v/TiaOpennessWrapper.dll"
            if (-not (Test-Path $wsDll)) { continue }
            $entry = $zip.GetEntry("extension/dotnet/TiaOpennessWrapper/bin/Release/net48/$v/TiaOpennessWrapper.dll")
            if (-not $entry) { Write-Host "      $v : NOT in VSIX" -ForegroundColor Yellow; continue }
            $s = $entry.Open(); $ms = New-Object System.IO.MemoryStream; $s.CopyTo($ms); $s.Close()
            $bytes = $ms.ToArray(); $ms.Close()
            $vH = [BitConverter]::ToString([System.Security.Cryptography.MD5]::Create().ComputeHash($bytes)).Replace('-','')
            $wsH = (Get-FileHash $wsDll -Algorithm MD5).Hash
            $tag = if ($vH -eq $wsH) { 'OK (matches workspace)' } else { 'MISMATCH!' }
            Write-Host ("      {0}: {1}  {2}" -f $v, $tag, $wsH) -ForegroundColor $(if ($vH -eq $wsH) {'Green'} else {'Red'})
        }
    } finally { $zip.Dispose() }

    Write-Host ""
    Write-Host "=== BUILD COMPLETE ===" -ForegroundColor Green
    Write-Host " VSIX: $vsixPath"

    # --- 6. Install (overlay) --------------------------------------------------
    if ($Install) {
        Write-Host ""
        Write-Host "=== INSTALL: overlaying VSIX onto running VS Code ===" -ForegroundColor Cyan
        $overlayScript = Join-Path $PSScriptRoot 'install-overlay.ps1'
        & pwsh -NoProfile -File $overlayScript -Vsix $vsixPath -Installed $installed -Workspace $Workspace
        if ($LASTEXITCODE -ne 0) { throw "Overlay install failed (exit $LASTEXITCODE)" }
    } else {
        Write-Host " (-BuildOnly: not installing. Run with -Install to overlay-install, or use install-overlay.ps1.)" -ForegroundColor DarkGray
    }
} finally {
    Pop-Location
}
