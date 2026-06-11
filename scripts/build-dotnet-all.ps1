#requires -Version 5
<#
.SYNOPSIS
  Builds the TiaOpennessWrapper for every TIA Portal major version that has
  reference assemblies available in dotnet/refs/V<n>/.
#>
$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root 'dotnet/TiaOpennessWrapper/TiaOpennessWrapper.csproj'
$refsDir = Join-Path $root 'dotnet/refs'

if (-not (Test-Path $refsDir)) {
    Write-Error "Reference folder not found: $refsDir"
    exit 1
}

$skipVersions = @('17')

$versions = @()
Get-ChildItem -Path $refsDir -Directory | ForEach-Object {
    if (Test-Path (Join-Path $_.FullName 'Siemens.Engineering.dll')) {
        $ver = $_.Name -replace '^V', ''
        if ($skipVersions -contains $ver) {
            Write-Host "Skipping TIA V$ver (excluded from build)" -ForegroundColor Yellow
        } else {
            $versions += $ver
        }
    }
}

if ($versions.Count -eq 0) {
    Write-Error "No TIA reference assemblies found in dotnet/refs/V<n>/. See dotnet/refs/README.md."
    exit 1
}

foreach ($v in $versions) {
    Write-Host "=== Building wrapper for TIA V$v ===" -ForegroundColor Cyan
    & dotnet build $project -c Release "/p:OpennessTiaMajor=$v"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
