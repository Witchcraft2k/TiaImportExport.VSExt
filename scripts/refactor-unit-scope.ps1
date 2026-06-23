param()
$ErrorActionPreference = 'Stop'

function Refactor-Handler {
    param(
        [string]$Path,
        [string]$OldRef,            # e.g. 'plcSoftware.TypeGroup'
        [string]$TypeName,          # e.g. 'PlcTypeGroup'
        [string]$RootVar,           # e.g. 'rootTypeGroup'   (no type prefix)
        [string]$OptionsProp        # e.g. 'RootTypeGroup'
    )
    $content = Get-Content $Path -Raw

    $oldLine = "$TypeName targetGroup = $OldRef;"
    $newLines = "$TypeName $RootVar = options.$OptionsProp ?? $OldRef;`r`n                $TypeName targetGroup = $RootVar;"

    if (-not $content.Contains($oldLine)) {
        Write-Warning "Marker not found in $Path : '$oldLine'"
        return
    }
    $content = $content.Replace($oldLine, $newLines)
    $content = $content.Replace($OldRef, $RootVar)
    $content = $content.Replace("options.$OptionsProp ?? $RootVar;", "options.$OptionsProp ?? $OldRef;")

    Set-Content -Path $Path -Value $content -NoNewline -Encoding utf8
    Write-Host "[$Path] refactored"
}

Refactor-Handler -Path 'dotnet/TiaOpennessWrapper/Services/Export/Software/UdtExportHandler.cs' `
    -OldRef 'plcSoftware.TypeGroup' `
    -TypeName 'PlcTypeGroup' `
    -RootVar 'rootTypeGroup' `
    -OptionsProp 'RootTypeGroup'

Refactor-Handler -Path 'dotnet/TiaOpennessWrapper/Services/Export/Software/TagTableExportHandler.cs' `
    -OldRef 'plcSoftware.TagTableGroup' `
    -TypeName 'PlcTagTableGroup' `
    -RootVar 'rootTagTableGroup' `
    -OptionsProp 'RootTagTableGroup'

Write-Host '--- counts ---'
Write-Host ('UDT old: '   + (Select-String -Path 'dotnet/TiaOpennessWrapper/Services/Export/Software/UdtExportHandler.cs' -Pattern 'plcSoftware\.TypeGroup').Count)
Write-Host ('UDT new: '   + (Select-String -Path 'dotnet/TiaOpennessWrapper/Services/Export/Software/UdtExportHandler.cs' -Pattern 'rootTypeGroup').Count)
Write-Host ('Tag old: '   + (Select-String -Path 'dotnet/TiaOpennessWrapper/Services/Export/Software/TagTableExportHandler.cs' -Pattern 'plcSoftware\.TagTableGroup').Count)
Write-Host ('Tag new: '   + (Select-String -Path 'dotnet/TiaOpennessWrapper/Services/Export/Software/TagTableExportHandler.cs' -Pattern 'rootTagTableGroup').Count)
