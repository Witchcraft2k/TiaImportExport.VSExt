<#
.SYNOPSIS
  Install a locally built TIA Portal Import VSIX by overlaying it onto the installed extension
  folder (works while VS Code is running).

.DESCRIPTION
  `code --install-extension x.vsix --force` fails on a running VS Code with
  `EPERM ... Please restart VS Code` because the active extension locks its native .node files and
  the extension folder cannot be renamed. This script extracts the VSIX directly over the installed
  extension folder instead.

  - Skips the node_modules/ subtree (byte-identical to the installed ext; avoids touching any
    loaded native binaries).
  - For LOCKED files (e.g. the active V21 TiaOpennessWrapper.dll) uses the rename-trick: rename the
    locked file to <name>.locked-orig (rename touches only the directory entry, not the data the
    process holds), then write the new file under the original name. Author originals are preserved
    as *.locked-orig backups.
  - The in-memory DLL only swaps after `Developer: Reload Window`.

  This is the install path used by the tia-fork-sync skill (see references/merge-strategy.md).

.PARAMETER Vsix
  Path to the .vsix to install. Defaults to the newest tia-import-*.vsix in the repo root.

.PARAMETER Installed
  Installed extension folder. If omitted, the highest-version mariuszczyrnek.tia-import-* under
  ~/.vscode/extensions is auto-detected.

.PARAMETER Workspace
  Repository root (for default Vsix detection). Defaults to the script's grandparent x4.

.EXAMPLE
  pwsh ./scripts/install-overlay.ps1 -Vsix .\tia-import-3.0.12.vsix
  pwsh ./scripts/install-overlay.ps1   # auto-detect newest vsix + installed folder
#>
[CmdletBinding()]
param(
    [string]$Vsix,
    [string]$Installed,
    [string]$Workspace
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

# --- Resolve workspace root ---------------------------------------------------
if (-not $Workspace) {
    $Workspace = (Resolve-Path (Join-Path $PSScriptRoot '..' '..' '..' '..')).Path
}

# --- Resolve VSIX -------------------------------------------------------------
if (-not $Vsix) {
    $candidates = Get-ChildItem $Workspace -Filter 'tia-import-*.vsix' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending
    if (-not $candidates) { throw "No tia-import-*.vsix found in $Workspace. Pass -Vsix explicitly." }
    $Vsix = $candidates[0].FullName
}
if (-not (Test-Path $Vsix)) { throw "VSIX not found: $Vsix" }

# --- Auto-detect installed extension ------------------------------------------
if (-not $Installed) {
    $extRoot = Join-Path $env:USERPROFILE '.vscode\extensions'
    $cands = Get-ChildItem $extRoot -Directory -Filter 'mariuszczyrnek*tia-import-*' -ErrorAction SilentlyContinue
    if (-not $cands) { throw "No installed mariuszczyrnek...tia-import-* under $extRoot." }
    $Installed = ($cands | Sort-Object { [version]($_.BaseName -replace '.*tia-import-', '') } -Descending | Select-Object -First 1).FullName
}
if (-not (Test-Path (Join-Path $Installed 'package.json'))) { throw "Installed folder invalid: $Installed" }

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " TIA Portal Import - overlay install" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " VSIX      : $Vsix"
Write-Host " Installed : $Installed"
Write-Host " (skipping node_modules/ - identical, avoids touching loaded natives)" -ForegroundColor DarkGray
Write-Host ""

$zip = [System.IO.Compression.ZipFile]::OpenRead($Vsix)
$extracted = 0; $skippedNm = 0; $failed = @()
try {
    foreach ($entry in $zip.Entries) {
        $name = $entry.FullName
        if (-not $name.StartsWith('extension/')) { continue }
        $rel = $name.Substring('extension/'.Length)
        if ($rel -eq '') { continue }
        if ($rel.StartsWith('node_modules/')) { $skippedNm++; continue }

        $relLocal = $rel -replace '/', '\'
        $target = Join-Path $Installed $relLocal
        if ($name.EndsWith('/')) {
            if (-not (Test-Path $target)) { New-Item -ItemType Directory -Path $target -Force | Out-Null }
            continue
        }
        $tdir = Split-Path $target -Parent
        if (-not (Test-Path $tdir)) { New-Item -ItemType Directory -Path $tdir -Force | Out-Null }

        try {
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
            $extracted++
        } catch {
            try {
                if (Test-Path $target) {
                    Rename-Item -LiteralPath $target -NewName ([IO.Path]::GetFileName($target) + '.locked-orig') -Force -ErrorAction Stop
                }
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
                $extracted++
                Write-Host "  (rename-trick) replaced locked: $rel" -ForegroundColor Yellow
            } catch {
                $failed += "$rel :: $($_.Exception.Message)"
            }
        }
    }
} finally {
    $zip.Dispose()
}

Write-Host ""
Write-Host "=== Overlay complete ===" -ForegroundColor Green
Write-Host " Files extracted:      $extracted"
Write-Host " node_modules skipped: $skippedNm (identical)"
Write-Host " Failed:               $($failed.Count)"
if ($failed.Count -gt 0) { $failed | ForEach-Object { Write-Host "  $_" -ForegroundColor Red } }

# --- Verify any fixed-version DLLs landed -------------------------------------
$dotnetRoot = Join-Path $Installed 'dotnet\TiaOpennessWrapper\bin\Release\net48'
if (Test-Path $dotnetRoot) {
    Write-Host ""
    Write-Host "--- Installed wrapper DLLs (verify the fix shipped) ---" -ForegroundColor Cyan
    foreach ($v in 'V18','V19','V20','V21') {
        $dll = Join-Path $dotnetRoot "$v\TiaOpennessWrapper.dll"
        if (Test-Path $dll) {
            $h = (Get-FileHash $dll -Algorithm MD5).Hash
            Write-Host ("  {0}: {1}  ({2} bytes)" -f $v, $h, (Get-Item $dll).Length)
        }
    }
}

Write-Host ""
Write-Host "NEXT: Run 'Developer: Reload Window' so the extension host reloads the new DLL." -ForegroundColor Cyan
Write-Host "      Author originals of locked files are preserved as *.locked-orig (delete after confirming)." -ForegroundColor DarkGray
