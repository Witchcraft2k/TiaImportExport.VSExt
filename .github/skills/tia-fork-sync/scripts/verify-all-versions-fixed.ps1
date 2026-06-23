<#
.SYNOPSIS
  Verify the per-version working state of the TIA Openness wrapper DLLs (V18/V19/V20/V21) for the
  Project Server / multiuser connect fix.

.DESCRIPTION
  The fix lives in shared C# source with no #if V18/V19/V20/V21 conditionals. `npm run build:dotnet`
  rebuilds each version from that source, but SKIPS any version whose nested `PublicAPI\V<n>\net48`
  reference directory is missing. IMPORTANT (corrected 2026-06-23): the fix is required by BOTH V19
  and V21 — V19 connect with the author's UNFIXED DLL returns "No projects found" against a Project
  Server (user-verified 2026-06-23). So "DLL == author baseline" DOES mean "broken for Project-Server
  use". The goal of this script is to surface per-version state; fix any flagged version via the
  targeted build in references/fix-deploy.md.

  Per version it reports:
    FIXED           = DLL differs from the author baseline (rebuilt with the fix)
    BASELINE-MATCH  = DLL == author baseline (no fix). Known-broken for V19 (Project Server);
                      genuinely suspect for any TIA-Portal-installed version not in -VerifiedWorking.
    NOT-INSTALLED   = TIA Portal V<n> not installed (folder absent, or a stub with no executable);
                      unverifiable — never causes a failure.
    MISSING-DLL     = TIA Portal installed but no wrapper DLL present (inconsistent — investigate).

  It flags a version as SUSPECT (and exits 1) only when: TIA Portal for that version IS installed,
  the DLL is BASELINE-MATCH, AND the version is NOT in -VerifiedWorking. NOT-INSTALLED versions
  (V18/V20 on this machine) never cause a failure — record them as a Known Limitation instead.

  See references/protected-files.md § "All-versions fix verification".

.PARAMETER Workspace
  Repository root. Defaults to the script's grandparent x4.

.PARAMETER BaselineCommit
  Git commit of the author baseline. Defaults to 50d1984 (the v3.0.0 import).

.PARAMETER VerifiedWorking
  Comma-separated list of versions confirmed working by user smoke-test
  (tiaImport.tiaPortalVersion:<n> -> connect to a Project Server -> list/select project).
  Defaults to "V19,V21". Add a version here once you have smoke-tested it working.

.EXAMPLE
  pwsh ./scripts/verify-all-versions-fixed.ps1
  pwsh ./scripts/verify-all-versions-fixed.ps1 -VerifiedWorking V19,V21
#>
[CmdletBinding()]
param(
    [string]$Workspace,
    [string]$BaselineCommit = '50d1984',
    [string]$VerifiedWorking = 'V19,V21'
)

$ErrorActionPreference = 'Stop'

if (-not $Workspace) {
    $Workspace = (Resolve-Path (Join-Path $PSScriptRoot '..' '..' '..' '..')).Path
}
# Normalize the verified-working list to a set of upper-cased version tokens (V18/V19/...).
$verifiedSet = @{}
foreach ($tok in ($VerifiedWorking -split ',')) {
    $t = $tok.Trim().ToUpper()
    if ($t -notlike 'V*') { $t = "V$t" }
    if ($t) { $verifiedSet[$t] = $true }
}

# Detect whether TIA Portal V<n> is really installed (not just a leftover stub folder).
# A real install has the Portal V<n> folder AND either the main executable or a PublicAPI tree.
# A stub (e.g. V20 after a partial uninstall) has only a Lib/ subfolder and no executable.
function Test-TiaPortalInstalled([string]$n) {
    $portalDir = "C:\Program Files\Siemens\Automation\Portal V$n"
    if (-not (Test-Path $portalDir)) { return $false }
    # Real install markers: the TIA Portal exe (varies by version) or a PublicAPI folder.
    $exeCandidates = @(
        Join-Path $portalDir 'bin\tiaap.exe'
        Join-Path $portalDir 'tiaap.exe'
        Join-Path $portalDir 'TiaPortal.exe'
    )
    foreach ($exe in $exeCandidates) { if (Test-Path $exe) { return $true } }
    if (Test-Path (Join-Path $portalDir 'PublicAPI')) { return $true }
    # If the folder only contains a stub marker (e.g. a lone Lib/ from a partial uninstall),
    # treat as not installed. Force @() so single-item indexing works (a bare string's [0] is a char).
    $children = @(Get-ChildItem $portalDir -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)
    if ($children.Count -le 2 -and ($children -iin @('Lib','Logs'))) { return $false }
    # Otherwise, assume installed (a real install has many subfolders: bin, Data, PublicAPI, ...).
    return $true
}

Push-Location $Workspace
try {
    $dllRel = 'dotnet/TiaOpennessWrapper/bin/Release/net48'
    $versions = 'V18','V19','V20','V21'

    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " TIA Openness wrapper - per-version working-state verification" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " Workspace        : $Workspace"
    Write-Host " Baseline commit  : $BaselineCommit (author v3.0.0 import, no fix)"
    Write-Host " VerifiedWorking  : $($verifiedSet.Keys -join ', ')"
    Write-Host " Goal             : every version the user runs works (NOT every DLL has the fix)"
    Write-Host ""

    # Author baseline hashes from git (the committed DLL at 50d1984 = no fix).
    # Start-Process -RedirectStandardOutput is binary-safe (PowerShell pipes mangle bytes).
    $baselineHash = @{}
    foreach ($v in $versions) {
        $gitPath = "$dllRel/$v/TiaOpennessWrapper.dll"
        $tmp = (Join-Path ([System.IO.Path]::GetTempPath()) "tia_baseline_$v.bin")
        $p = Start-Process -FilePath git -ArgumentList @('show', "${BaselineCommit}:$gitPath") `
            -NoNewWindow -Wait -PassThru -RedirectStandardOutput $tmp
        if ($p.ExitCode -eq 0 -and (Test-Path $tmp) -and (Get-Item $tmp).Length -gt 0) {
            $baselineHash[$v] = (Get-FileHash $tmp -Algorithm MD5).Hash
        }
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    }

    Write-Host "--- Per-version status ---" -ForegroundColor Cyan
    $fixed = @(); $baselineMatch = @(); $notInstalled = @(); $missingDll = @(); $suspect = @()
    foreach ($v in $versions) {
        $n = $v -replace 'V',''
        $tiaInstalled = Test-TiaPortalInstalled $n
        $dll = Join-Path $Workspace "$dllRel/$v/TiaOpennessWrapper.dll"

        if (-not $tiaInstalled) {
            Write-Host ("  {0,-4}: NOT-INSTALLED  (TIA Portal V{1} not installed -> unverifiable)" -f $v, $n) -ForegroundColor DarkGray
            $notInstalled += $v; continue
        }
        if (-not (Test-Path $dll)) {
            Write-Host ("  {0,-4}: MISSING-DLL    (TIA Portal V{1} installed but no wrapper DLL -> investigate)" -f $v, $n) -ForegroundColor Magenta
            $missingDll += $v; continue
        }

        $h = (Get-FileHash $dll -Algorithm MD5).Hash
        $bh = $baselineHash[$v]
        $isVerified = $verifiedSet.ContainsKey($v)
        if ($h -ne $bh) {
            Write-Host ("  {0,-4}: FIXED          (hash {1} != baseline {2})" -f $v, $h, $bh) -ForegroundColor Green
            $fixed += $v
        } else {
            $tag = if ($isVerified) { 'verified working' } else { 'NOT verified -> SUSPECT' }
            $color = if ($isVerified) { 'Green' } else { 'Red' }
            Write-Host ("  {0,-4}: BASELINE-MATCH (hash {1} == baseline, no fix) [{2}]" -f $v, $h, $tag) -ForegroundColor $color
            $baselineMatch += $v
            if (-not $isVerified) { $suspect += $v }
        }
    }

    Write-Host ""
    Write-Host "--- Openness PublicAPI per version (build eligibility) ---" -ForegroundColor Cyan
    # Match build-dotnet.js: build runs if PublicAPI\V<n>\net48 DIR exists, or dotnet/refs/V<n>\Siemens.Engineering.dll.
    foreach ($v in $versions) {
        $n = $v -replace 'V',''
        $apiDir = "C:\Program Files\Siemens\Automation\Portal V$n\PublicAPI\V$n\net48"
        $refsDll = Join-Path $Workspace "dotnet/refs/V$n/Siemens.Engineering.dll"
        $apiOk = Test-Path $apiDir
        $refsOk = Test-Path $refsDll
        $src = if ($apiOk) { 'PublicAPI (dir present -> builds)' } elseif ($refsOk) { 'dotnet/refs (fallback -> builds)' } else { 'NONE -> skipped by build' }
        Write-Host ("  {0,-4}: refs={1}" -f $v, $src)
    }

    Write-Host ""
    Write-Host "=== Summary ===" -ForegroundColor Cyan
    Write-Host " FIXED          : $($fixed -join ', ')" -ForegroundColor Green
    Write-Host " BASELINE-MATCH : $($baselineMatch -join ', ')" -ForegroundColor $(if ($suspect) {'Yellow'} else {'Green'})
    Write-Host " NOT-INSTALLED  : $($notInstalled -join ', ')" -ForegroundColor DarkGray
    if ($missingDll) { Write-Host " MISSING-DLL    : $($missingDll -join ', ')" -ForegroundColor Magenta }
    if ($suspect)    { Write-Host " SUSPECT        : $($suspect -join ', ') (installed + baseline-match + not verified-working)" -ForegroundColor Red }

    if ($notInstalled.Count -gt 0) {
        Write-Host ""
        Write-Host "NOT-INSTALLED versions ($($notInstalled -join ', ')) are unverifiable." -ForegroundColor DarkGray
        Write-Host "  Record them as a Known Limitation in the changelog + MemPalace (do NOT claim fixed or broken)." -ForegroundColor DarkGray
    }
    if ($suspect.Count -gt 0) {
        Write-Host ""
        Write-Host "ACTION: SUSPECT versions are TIA-Portal-installed, BASELINE-MATCH, and NOT user-verified-working." -ForegroundColor Yellow
        Write-Host "  1. Smoke-test: set tiaImport.tiaPortalVersion:<n>, connect to a Project Server, list/select." -ForegroundColor Yellow
        Write-Host "     If it works, add it to -VerifiedWorking and re-run." -ForegroundColor Yellow
        Write-Host "  2. If it does NOT work and needs the fix: install the TIA Portal Openness option for that" -ForegroundColor Yellow
        Write-Host "     version (Siemens installer -> Modify -> 'TIA Portal Openness') so PublicAPI\V<n>\net48" -ForegroundColor Yellow
        Write-Host "     appears, then 'npm run build:dotnet'; or copy Siemens.Engineering*.dll into dotnet/refs/V<n>/." -ForegroundColor Yellow
    }
    if ($missingDll.Count -gt 0) {
        Write-Host ""
        Write-Host "ACTION: MISSING-DLL versions have TIA Portal installed but no wrapper DLL. Run 'npm run build:dotnet'." -ForegroundColor Magenta
    }

    # Exit non-zero only on a genuinely suspect or inconsistent state, so this can gate the procedure.
    # NOT-INSTALLED versions (V18/V20) never cause a failure.
    if ($suspect.Count -gt 0 -or $missingDll.Count -gt 0) { exit 1 }
} finally {
    Pop-Location
}
