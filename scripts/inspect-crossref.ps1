$dir = 'C:\Program Files\Siemens\Automation\Portal V21\PublicAPI\V21\net48'
$script:dir = $dir
$resolver = [ResolveEventHandler]{
    param($s, $e)
    $name = (New-Object System.Reflection.AssemblyName($e.Name)).Name
    $p = Join-Path $script:dir ($name + '.dll')
    if (Test-Path $p) { return [System.Reflection.Assembly]::LoadFrom($p) }
    return $null
}
[System.AppDomain]::CurrentDomain.add_AssemblyResolve($resolver)
try {
    foreach ($f in Get-ChildItem -Path $dir -Filter 'Siemens.Engineering*.dll') {
        try {
            $asm = [System.Reflection.Assembly]::LoadFrom($f.FullName)
            foreach ($t in $asm.GetExportedTypes()) {
                if ($t.FullName -match 'CrossReference') {
                    Write-Output ("{0} :: {1}" -f $asm.GetName().Name, $t.FullName)
                }
            }
        } catch {
            Write-Output ("ERR {0}: {1}" -f $f.Name, $_.Exception.Message)
        }
    }
} finally {
    [System.AppDomain]::CurrentDomain.remove_AssemblyResolve($resolver)
}
