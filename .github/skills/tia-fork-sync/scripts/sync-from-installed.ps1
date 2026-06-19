<#
.SYNOPSIS
  Sync the TIA Portal Import fork's out/ JS layer from the author's installed VSIX.

.DESCRIPTION
  Auto-detects the highest-version installed "mariuszcz...tia-import-*" extension under
  ~/.vscode/extensions, classifies every out/ file (NEW / CHANGED / IDENTICAL /
  WORKSPACE-ONLY), reports package.json + changelog deltas, and with -Apply copies the
  installed out/ wholesale into the workspace. NEVER touches dotnet/ (the .NET wrapper
  carries the project-server/multiuser fix and is rebuilt from source, not copied).

.PARAMETER Workspace
  Repository root (defaults to the script's grandparent: .github/skills/tia-fork-sync -> repo root).

.PARAMETER Installed
  Installed extension folder. If omitted, the highest-version match is auto-detected.

.PARAMETER Apply
  Perform the out/ copy. Without it, the script is a read-only dry-run report.

.EXAMPLE
  pwsh ./scripts/sync-from-installed.ps1            # dry-run report
  pwsh ./scripts/sync-from-installed.ps1 -Apply     # copy out/ from installed VSIX
#>
[CmdletBinding()]
param(
    [string]$Workspace,
    [string]$Installed,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'

# --- Resolve workspace root ---------------------------------------------------
if (-not $Workspace) {
    # scripts/sync-from-installed.ps1 lives at .github/skills/tia-fork-sync/scripts/
    # -> repo root is 4 levels up: scripts -> tia-fork-sync -> skills -> .github -> root
    $Workspace = (Resolve-Path (Join-Path $PSScriptRoot '..' '..' '..' '..')).Path
}
if (-not (Test-Path (Join-Path $Workspace 'package.json'))) {
    throw "Workspace root does not look like the repo: $Workspace (no package.json)"
}

# --- Auto-detect installed extension ------------------------------------------
if (-not $Installed) {
    $extRoots = @(
        Join-Path $env:USERPROFILE '.vscode\extensions'
        Join-Path $env:USERPROFILE '.vscode-insiders\extensions'
    ) | Where-Object { Test-Path $_ }

    $candidates = foreach ($root in $extRoots) {
        Get-ChildItem $root -Directory -Filter 'mariuszcz*tia-import-*' -ErrorAction SilentlyContinue
    }
    if (-not $candidates) {
        throw "No installed 'mariuszcz...tia-import-*' extension found under $($extRoots -join ' / ')."
    }
    # Highest version = sort by the trailing semver, longest match first.
    $Installed = ($candidates |
        Sort-Object { [version]($_.BaseName -replace '.*tia-import-', '') } -Descending |
        Select-Object -First 1).FullName
}

if (-not (Test-Path (Join-Path $Installed 'package.json'))) {
    throw "Installed folder does not look like the extension: $Installed (no package.json)"
}

# --- Read versions ------------------------------------------------------------
$wsPkg    = Get-Content (Join-Path $Workspace 'package.json') -Raw | ConvertFrom-Json
$instPkg  = Get-Content (Join-Path $Installed 'package.json') -Raw | ConvertFrom-Json

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " TIA Portal Import — fork sync from installed VSIX" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Workspace : $Workspace"
Write-Host "            package.json version = $($wsPkg.version)"
Write-Host " Installed : $Installed"
Write-Host "            package.json version = $($instPkg.version)"
Write-Host " Mode      : $(if ($Apply) { 'APPLY (copy out/ from installed)' } else { 'DRY-RUN (report only)' })"
Write-Host ""

if ([version]$instPkg.version -le [version]$wsPkg.version) {
    Write-Host "WARNING: installed ($($instPkg.version)) is not newer than workspace ($($wsPkg.version))." -ForegroundColor Yellow
    Write-Host "         Nothing to pull. Aborting." -ForegroundColor Yellow
    return
}

# --- Classify out/ files ------------------------------------------------------
$wsOut    = Join-Path $Workspace 'out'
$instOut  = Join-Path $Installed 'out'
if (-not (Test-Path $instOut)) { throw "Installed extension has no out/ at $instOut" }

$instFiles = Get-ChildItem $instOut -Recurse -File -ErrorAction SilentlyContinue
$wsFiles   = if (Test-Path $wsOut) { Get-ChildItem $wsOut -Recurse -File -ErrorAction SilentlyContinue } else { @() }

$instMap = @{}
foreach ($f in $instFiles) { $instMap[$f.FullName.Substring($instOut.Length + 1)] = $f }
$wsMap   = @{}
foreach ($f in $wsFiles)   { $wsMap[$f.FullName.Substring($wsOut.Length + 1)]   = $f }

$newFiles        = @()
$changedFiles    = @()
$identicalFiles  = @()
$workspaceOnly   = @()

foreach ($rel in ($instMap.Keys | Sort-Object)) {
    if (-not $wsMap.ContainsKey($rel)) {
        $newFiles += $rel
        continue
    }
    $h1 = (Get-FileHash $instMap[$rel].FullName -Algorithm MD5).Hash
    $h2 = (Get-FileHash $wsMap[$rel].FullName   -Algorithm MD5).Hash
    if ($h1 -eq $h2) { $identicalFiles += $rel } else { $changedFiles += $rel }
}
foreach ($rel in ($wsMap.Keys | Sort-Object)) {
    if (-not $instMap.ContainsKey($rel)) { $workspaceOnly += $rel }
}

Write-Host "--- out/ classification ---" -ForegroundColor Cyan
Write-Host (" NEW             : {0}" -f $newFiles.Count)
Write-Host (" CHANGED         : {0}" -f $changedFiles.Count)
Write-Host (" IDENTICAL       : {0}" -f $identicalFiles.Count)
Write-Host (" WORKSPACE-ONLY  : {0}  (review: keep local additions or delete if author dropped them)" -f $workspaceOnly.Count)
Write-Host ""

if ($newFiles.Count)       { Write-Host "[NEW]";            $newFiles      | ForEach-Object { Write-Host "  $_" } }
if ($changedFiles.Count)   { Write-Host "[CHANGED]";        $changedFiles  | ForEach-Object { Write-Host "  $_" } }
if ($workspaceOnly.Count)  { Write-Host "[WORKSPACE-ONLY]"; $workspaceOnly | ForEach-Object { Write-Host "  $_" } }
Write-Host ""

# --- package.json delta (structural, report only) -----------------------------
Write-Host "--- package.json delta (report; merge manually per skill) ---" -ForegroundColor Cyan
function Compare-JsonProperty($ws, $inst, $name) {
    $w = if ($null -ne $ws.$name)   { ($ws.$name   | ConvertTo-Json -Depth 8 -Compress) } else { $null }
    $i = if ($null -ne $inst.$name) { ($inst.$name | ConvertTo-Json -Depth 8 -Compress) } else { $null }
    if ($w -ne $i) { Write-Host ("  {0}: DIFFERS (workspace vs installed)" -f $name) -ForegroundColor Yellow }
}
Compare-JsonProperty $wsPkg $instPkg 'activationEvents'
Compare-JsonProperty $wsPkg $instPkg 'dependencies'
Compare-JsonProperty $wsPkg $instPkg 'devDependencies'

$wCmds = @($wsPkg.contributes.commands       | ForEach-Object { $_.command }) | Sort-Object
$iCmds = @($instPkg.contributes.commands     | ForEach-Object { $_.command }) | Sort-Object
$addedCmds   = (Compare-Object $wCmds $iCmds | Where-Object SideIndicator -eq '=>').InputObject
$removedCmds = (Compare-Object $wCmds $iCmds | Where-Object SideIndicator -eq '<=').InputObject
if ($addedCmds)   { Write-Host "  contributes.commands ADDED by upstream:   $($addedCmds   -join ', ')" -ForegroundColor Green }
if ($removedCmds) { Write-Host "  contributes.commands only in workspace:    $($removedCmds -join ', ')" -ForegroundColor DarkGray }

$wCfg = @($wsPkg.contributes.configuration.properties.PSObject.Properties.Name)   | Sort-Object
$iCfg = @($instPkg.contributes.configuration.properties.PSObject.Properties.Name) | Sort-Object
$addedCfg   = (Compare-Object $wCfg $iCfg | Where-Object SideIndicator -eq '=>').InputObject
$removedCfg = (Compare-Object $wCfg $iCfg | Where-Object SideIndicator -eq '<=').InputObject
if ($addedCfg)   { Write-Host "  configuration.properties ADDED by upstream: $($addedCfg   -join ', ')" -ForegroundColor Green }
if ($removedCfg) { Write-Host "  configuration.properties only in workspace:  $($removedCfg -join ', ')" -ForegroundColor DarkGray }

# Flag known upstream default changes that matter for the merge
$cliWs  = $wsPkg.contributes.configuration.properties.'tiaImport.cli.enabled'
$cliIns = $instPkg.contributes.configuration.properties.'tiaImport.cli.enabled'
if ($cliWs.default -ne $cliIns.default) {
    Write-Host "  tiaImport.cli.enabled.default: workspace=$($cliWs.default) -> installed=$($cliIns.default) (3.0.11 made CLI opt-in)" -ForegroundColor Yellow
}
Write-Host ""

# --- changelog delta ----------------------------------------------------------
function Find-Changelog($root) {
    foreach ($n in 'CHANGELOG.md','changelog.md','ChangeLog.md') {
        $p = Join-Path $root $n; if (Test-Path $p) { return $p }
    }
    return $null
}
$wsLog   = Find-Changelog $Workspace
$instLog = Find-Changelog $Installed
Write-Host "--- changelog delta ---" -ForegroundColor Cyan
if ($wsLog -and $instLog) {
    Write-Host "  workspace: $wsLog"
    Write-Host "  installed: $instLog"
    $instHeaders = Select-String -Path $instLog -Pattern '^## \[' -AllMatches |
        ForEach-Object { if ($_.Line -match '^## \[([^\]]+)\]') { $matches[1] } }
    $wsHeaders    = Select-String -Path $wsLog   -Pattern '^## \[' -AllMatches |
        ForEach-Object { if ($_.Line -match '^## \[([^\]]+)\]') { $matches[1] } }
    $missing = $instHeaders | Where-Object { $wsHeaders -notcontains $_ }
    if ($missing) {
        Write-Host "  Upstream changelog entries NOT in workspace (prepend these): $($missing -join ', ')" -ForegroundColor Green
    } else {
        Write-Host "  Workspace already has all upstream changelog entries." -ForegroundColor DarkGray
    }
} else {
    Write-Host "  Could not locate both changelogs (workspace=$wsLog, installed=$instLog)." -ForegroundColor Yellow
}
Write-Host ""

# --- Apply: copy out/ from installed (never dotnet/) --------------------------
if ($Apply) {
    Write-Host "--- APPLY: copying out/ from installed VSIX ---" -ForegroundColor Green
    $copied = 0
    foreach ($rel in ($instMap.Keys | Sort-Object)) {
        $src = $instMap[$rel].FullName
        $dst = Join-Path $wsOut $rel
        $dir = Split-Path $dst -Parent
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        Copy-Item -LiteralPath $src -Destination $dst -Force
        $copied++
    }
    Write-Host "  Copied $copied files into $wsOut" -ForegroundColor Green
    if ($workspaceOnly.Count) {
        Write-Host "  Left $($workspaceOnly.Count) WORKSPACE-ONLY file(s) in place (review manually):" -ForegroundColor Yellow
        $workspaceOnly | ForEach-Object { Write-Host "    $_" }
    }
    Write-Host "  dotnet/ was NOT touched (rebuild with 'npm run build:dotnet')." -ForegroundColor Cyan
    Write-Host "  Next: merge package.json + changelog manually, then run validation gates." -ForegroundColor Cyan
} else {
    Write-Host "Dry-run complete. Re-run with -Apply to copy out/ from the installed VSIX." -ForegroundColor Cyan
}
