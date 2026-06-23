# Quick Fix Deploy — install the Project Server fix into a newer installed extension

The **deep fork-sync** procedure ([SKILL.md](../SKILL.md)) pulls the author's newest features into the fork and ships a VSIX. The **Quick Fix Deploy** here is the lighter path when the only goal is "make the author's freshly-installed extension load projects from a TIA Portal **Project Server** (multiuser)" — without a full merge, VSIX build, or overlay of the whole fork. V19 and V21 are the supported versions; V18/V20 are not installed and unverifiable.

This is what was verified working on **2026-06-23** for installed `mariuszczyrnek.tia-import-3.0.57` (V21 and V19 both connect to a Project Server afterwards).

## Verified facts this procedure relies on (do NOT rediscover)

1. **The Project Server / multiuser `Tia Connect` fix lives entirely in the .NET wrapper C# source** — the same four protected files ([protected-files.md](protected-files.md)). The installed author VSIX contains **no C# source**, only compiled DLLs built **without** the fix. The fix is therefore applied by **rebuilding the wrapper from the fork source** and swapping the resulting fixed DLL + co-located deps into the installed extension folder.
2. **The fix is in shared C# source with NO `#if V18/V19/V20/V21` conditionals.** Compiling that same source under `/p:OpennessTiaMajor=<n>` produces a fixed binary for every version whose Openness reference assemblies resolve. Reference resolution per version is in `TiaOpennessWrapper.csproj`.
3. **⚠️ Do NOT run `npm run build:dotnet` here.** `scripts/build-dotnet.js` calls `cleanOutputRoot()` which **deletes the entire `dotnet/bin/Release/net48/` first** — destroying the committed V21 fixed DLL and the V18/V20 baseline DLLs. It then skips any version whose `PublicAPI\V<n>\net48` directory is absent. Build **targeted** instead (see step 3) so only the single version's DLL is rebuilt and nothing else is clobbered.
4. **The installed author wrapper must NOT be overwritten in place while VS Code is running** — the extension host locks the active `TiaOpennessWrapper.dll` (a `Copy-Item` fails with "being used by another process"). Use the **locked-DLL rename-trick**: rename the locked author DLL aside (rename touches only the directory entry, not the data the process holds), then write the new file under the original name. The in-memory DLL only swaps after `Developer: Reload Window`.

## Two dep-layout gotchas that cost a debugging cycle (2026-06-23)

These two pitfalls are why a naive "swap the DLL" fails with
`Could not load file or assembly 'Siemens.Collaboration.Net, Version=3.0.0.0'`.

**A. The fork wrapper requires **co-located** deps, not the author's shared `common/`.**
The author's 2.0.134 change deduplicated the per-version .NET dependencies into
`dotnet/TiaOpennessWrapper/bin/Release/net48/common/`, and the author's 3.0.57 wrapper
is built to resolve them from there. **The fork wrapper is frozen at the pre-dedup
layout**: it expects every dependency DLL (incl. the Openness Resolver) to sit
**alongside** the wrapper in `bin/Release/net48/V<n>/`. The installed author folder
for V<n> only has `TiaOpennessWrapper.dll` + the `common/` siblings, so the fork DLL
fails to resolve its transitive deps → `Siemens.Collaboration.Net` FileNotFound even
though the version numbers match. **Always copy the 15 fork co-located deps into the
installed V<n> folder alongside the swapped wrapper.**

**B. `Siemens.Collaboration.Net.dll` is a 23 KB type-forwarder stub.**
It forwards types to a real target assembly resolved by the Openness **Resolver**
(`Siemens.Collaboration.Net.TiaPortal.Openness.Resolver.dll`, ~40 KB). Without the
resolver DLL present where the CLR probes for the wrapper (i.e. **co-located in the
version folder**, per pitfall A), the forwarder has no resolution hook →
`Siemens.Collaboration.Net` throws even though the call site version matches.
Confirm the resolver is among the 15 co-located deps before declaring done.

The 15 co-located deps (identical across V19/V21 fork folders) are:
```
ClosedXML.dll, DocumentFormat.OpenXml.dll, ExcelNumberFormat.dll, Newtonsoft.Json.dll,
Siemens.Collaboration.Net.CoreExtensions.dll, Siemens.Collaboration.Net.dll,
Siemens.Collaboration.Net.Logging.dll, Siemens.Collaboration.Net.OperatingSystem.Windows.dll,
Siemens.Collaboration.Net.TiaPortal.Openness.Resolver.dll,   <- the resolver
Siemens.Collaboration.Net.Windows.Authentication.dll,
System.CodeDom.dll, System.IO.FileSystem.AccessControl.dll, System.IO.Packaging.dll,
System.Security.AccessControl.dll, System.Security.Principal.Windows.dll
```
They are **byte-identical** to the installed extension's `common/` (verified
2026-06-23), so co-locating them is harmless duplication — keep them in the version
folder so the fork wrapper resolves them.

## Prerequisites

- Fork workspace with the fix intact: the four protected `.cs` files differ from
  author baseline `50d1984` and `TiaConnectionManager.cs` carries
  `using Siemens.Engineering.Multiuser;`. Verify:
  ```powershell
  $repo = "<path>\TiaImportExport.VSExt"
  git -C $repo diff --name-only 50d1984 HEAD -- "dotnet/**/*.cs"
  Select-String -Path "$repo\dotnet\TiaOpennessWrapper\TiaOpennessWrapper.Services\TiaConnectionManager.cs" -Pattern 'Siemens.Engineering.Multiuser'
  ```
  Expect exactly four `.cs` files and the `Multiuser` line present. If not, do NOT
  proceed — the fix is not where this procedure assumes.
- A committed fixed wrapper DLL for each version to deploy, **or** the ability to
  build one (step 3). For V21 the committed `bin/Release/net48/V21/` DLL already
  carries the fix (use it directly). For V19 you must build (committed V19 DLL is
  the unfixed author baseline).
- The newer author extension installed under
  `~/.vscode/extensions/mariuszcz...tia-import-<version>/`.

## Procedure

### 0. Determine versions to deploy + which DLLs are ready

Create the per-version fixed wrapper DLLs in the fork workspace first.

```powershell
$repo = "<path>\TiaImportExport.VSExt"
$instRoot = "$env:USERPROFILE\.vscode\extensions"
$inst = (Get-ChildItem $instRoot -Directory -Filter 'mariuszcz*tia-import-*' |
    Sort-Object { [version]($_.BaseName -replace '.*tia-import-','') } -Descending | Select-Object -First 1).FullName
$binRoot = "$repo\dotnet\TiaOpennessWrapper\bin\Release\net48"
foreach ($v in 19, 21) {
    $dll = "$binRoot\V$v\TiaOpennessWrapper.dll"
    Write-Host "V$v fixed DLL present: $(Test-Path $dll)  hash=$((if (Test-Path $dll) { (Get-FileHash $dll -Algorithm SHA256).Hash } else { 'n/a' }))"
}
```
V21's committed DLL carries the fix → use as-is. V19's committed DLL is the unfixed
author baseline → **build** (step 3).

### 1. Build a fixed V19 DLL (targeted — does NOT clobber other versions)

This bypasses `build-dotnet.js` (which `cleanOutputRoot()`s first) and runs a single
`dotnet build` for V19. The `.csproj` resolves V19's `Siemens.Engineering.dll` from
the **flat** `C:\Program Files\Siemens\Automation\Portal V19\PublicAPI\V19\` (no
`net48` subfolder on V19 — that is why `build-dotnet.js` skips it; the project file
does not).

```powershell
dotnet build "$repo\dotnet\TiaOpennessWrapper\TiaOpennessWrapper.csproj" `
    -c Release /p:OpennessTiaMajor=19 -v minimal
```
Expect: 0 errors (many CS86xx nullable warnings are normal). Output lands in
`$binRoot\V19\TiaOpennessWrapper.dll`. Verify it differs from the unfixed author
DLL in the installed extension.

### 2. For each target version (V19, V21): co-locate deps + swap the fixed DLL

Put the procedure in a loop. For V21 the active author DLL is typically **not
locked** (the user connected with V19 last), so `Copy-Item` works. For V19 it is
often **locked** → use the rename-trick. The robust script below always uses the
rename-trick (works whether locked or not):

```powershell
$srcBin = "$repo\dotnet\TiaOpennessWrapper\bin\Release\net48"
foreach ($v in 19, 21) {
    $dst  = "$inst\dotnet\TiaOpennessWrapper\bin\Release\net48\V$v"
    $fixed = "$srcBin\V$v\TiaOpennessWrapper.dll"
    $active = "$dst\TiaOpennessWrapper.dll"
    $aside  = "$dst\TiaOpennessWrapper.dll.locked-orig-$(Get-Date -Format yyyy-MM-dd)"

    # (1) co-locate the 15 fork deps alongside the wrapper (incl. the Resolver)
    Get-ChildItem "$srcBin\V$v" -File |
        Where-Object { $_.Name -ne 'TiaOpennessWrapper.dll' -and $_.Name -ne 'TiaOpennessWrapper.pdb' } |
        ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dst $_.Name) -Force }

    # (2) back up + rename the active author DLL aside (rename-trick)
    if (-not (Test-Path $active)) {
        Write-Warning "V$v: no active DLL at $active — nothing to swap"; continue
    }
    if (-not (Test-Path $aside)) { Copy-Item -LiteralPath $active -Destination $aside -Force }
    Rename-Item -LiteralPath $active -NewName (Split-Path $aside -Leaf) -Force -ErrorAction SilentlyContinue
    # if the rename was skipped (name collision with an existing aside), remove active first
    if (Test-Path $active) { Remove-Item -LiteralPath $active -Force }

    # (3) write the fixed DLL under the original name
    Copy-Item -LiteralPath $fixed -Destination $active -Force

    # (4) verify
    $hActive = (Get-FileHash $active -Algorithm SHA256).Hash
    $hFixed  = (Get-FileHash $fixed  -Algorithm SHA256).Hash
    $resolverOk = Test-Path "$dst\Siemens.Collaboration.Net.TiaPortal.Openness.Resolver.dll"
    Write-Host "V$v: active=$($hActive.Substring(0,12)) fixed=$($hFixed.Substring(0,12)) match=$($hActive -eq $hFixed) resolver=$resolverOk"
}
```
All targets must print `match=True resolver=True`. A `match=False` means the DLL
wasn't written to the active path; `resolver=False` means the deps didn't co-locate
— re-check `$srcBin\V<v>\` contents.

### 3. Hand off — reload + smoke-test

1. `Developer: Reload Window` (mandatory — the host holds the old author DLL in
   memory until restart).
2. Set `tiaImport.tiaPortalVersion: 21` → `TIA Import: Connect to TIA Portal` to a
   **Project Server** → projects populate. Repeat with `tiaPortalVersion: 19`.
3. Record the per-version working state (MemPalace + changelog).

## Rollback (per version)

```powershell
$dst = "$inst\dotnet\TiaOpennessWrapper\bin\Release\net48\V<v>"
Remove-Item "$dst\TiaOpennessWrapper.dll" -Force
Get-ChildItem $dst -Filter "TiaOpennessWrapper.dll.locked-orig-*" | Select-Object -First 1 |
    Rename-Item -NewName "TiaOpennessWrapper.dll"
# (leave the 15 co-located deps; harmless byte-identical copies of common/)
```
Then Reload Window.

## When to escalate to the deep fork-sync instead

Use the Quick Fix Deploy when: the only goal is Project Server load on the
newly-installed author extension, and the user is NOT asking for the author's new
upstream features (e.g. Software Units) to work through the wrapper.

Use the deep [SKILL.md](../SKILL.md) procedure when: the user wants a full merge,
or when the synced JS calls `.NET` methods the fork wrapper doesn't register — the
memory of a Quick Fix Deploy intentionally leaves those methods unimplemented
(they return `{success:false, error:"Unknown method: <M>"}`, a clean error not a
crash). The full merge is what *also* adds those handlers to the C# source.