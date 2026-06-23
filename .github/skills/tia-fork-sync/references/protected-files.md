# Protected Files — the Project Server / multiuser `Tia Connect` fix

This fork's whole reason for existing is a fix that lets **`TIA Import: Connect to TIA Portal`**
open projects hosted on a **TIA Portal Project Server** (multiuser sessions). The author's
upstream extension does not include this fix, and the published VSIX contains **no C# source**, so
the fix is preserved automatically as long as you follow the rules below.

## Where the fix lives

The fix is entirely in the **.NET Openness wrapper C# source**. Verified via
`git diff 50d1984 HEAD -- "dotnet/**/*.cs"` (the pure author v3.0.0 import vs the current fork HEAD):

| File | Role |
|------|------|
| `dotnet/TiaOpennessWrapper/TiaOpennessWrapper/TiaConnector.cs` | Core `TiaConnector` — `tiaMethodRouter.Register(...)` method registry; the method-parity gate reads this. |
| `dotnet/TiaOpennessWrapper/TiaOpennessWrapper/TiaPortalService.cs` | `TiaPortalService` — connect/attach/open project, Project Server session handling. |
| `dotnet/TiaOpennessWrapper/TiaOpennessWrapper.Interop.Handlers/ConnectionMethodsHandler.cs` | Connect / Disconnect / Detach / Ping handlers. |
| `dotnet/TiaOpennessWrapper/TiaOpennessWrapper.Services/TiaConnectionManager.cs` | **`using Siemens.Engineering.Multiuser;`** — multiuser / Project Server project enumeration and selection. |

The fix is recognisable by the `Siemens.Engineering.Multiuser` namespace usage and the
`ProjectBase` / project-server enumeration logic in `TiaConnectionManager` (handles projects
served by a TIA Portal Project Server, not just local `.ap17`/`.ap18`/… files).

**The fix is in shared source with NO `#if V18/V19/V20/V21` conditionals** — there is no
per-version code path. `build:dotnet` compiles each version from the same fixed source, so a clean
rebuild fixes every version **that the build actually runs for** (see "All-versions fix
verification" below).

## Where the fix does NOT live

- **`out/`** (the extension's compiled JS). `git diff 50d1984 HEAD -- out/` is empty — the fork's
  JS is the unmodified author v3.0.0 JS. Safe to replace wholesale from the installed VSIX.
- `package.json`, `changelog.md`, resources — no fix-bearing content.

## Rules

1. **Never overwrite** the four C# files above from the installed VSIX (the VSIX has no source for
   them anyway; it only ships compiled `dotnet/**/bin/**` DLLs).
2. **Never copy** `dotnet/**/bin/**` or `dotnet/**/obj/**` from the installed VSIX into the fork —
   those DLLs were built by the author **without** the Project Server fix and would silently
   regress it. Rebuild from the fork's source with `npm run build:dotnet`.
3. When the synced `out/` JS calls a .NET method that the wrapper does not yet register, **add** the
   new `tiaMethodRouter.Register("Method", handler.Method)` entry + handler method in the matching
   `*MethodsHandler.cs` file. Append alongside the existing Project Server code; do **not** rewrite
   the existing connection/multiuser code to make room.
4. After any C# change, re-run `npm run test:method-parity` and `npm run build:dotnet`.
5. **Rebuild fixes only the versions whose Openness PublicAPI is installed** (see below). Always run
   the all-versions verification after building.

## All-versions fix verification

`scripts/build-dotnet.js` builds each version in `[18, 19, 20, 21]` but **skips** any version whose
reference assemblies are unavailable:

- Primary: `C:\Program Files\Siemens\Automation\Portal V<n>\PublicAPI\V<n>\net48\` (requires the
  **TIA Portal Openness (PublicAPI)** installer option for that version — not the base TIA Portal
  install). The build checks the **directory**, not a specific DLL.
- Fallback: `dotnet/refs/V<n>/` containing at least `Siemens.Engineering.dll`.

A skipped version's `bin/Release/net48/V<n>/TiaOpennessWrapper.dll` keeps its existing binary.

### The goal is "working", not "every DLL has the fix"

⚠️ The Project Server fix is **required by both V19 and V21** (corrected 2026-06-23). The earlier
note (2026-06-19) that "V19 works with the author's unfixed DLL" was a misread: V19 connect
**without** the fix enumerates only local projects and returns **"No projects found"** against a
Project Server — exactly the symptom the fix resolves. So a version whose DLL matches the author
baseline IS broken for Project-Server use (V19 proves it). Do NOT assume "baseline-match = still
fine". Verify by smoke-test (`tiaImport.tiaPortalVersion: <n>` → connect to a Project Server →
list/select project); if it returns "No projects found", build + deploy a fixed DLL per
[fix-deploy.md](fix-deploy.md).

### Verify after every build

```powershell
pwsh ./.github/skills/tia-fork-sync/scripts/verify-all-versions-fixed.ps1 -VerifiedWorking V19,V21
```

It reports each version as **FIXED** (differs from author baseline `50d1984`), **BASELINE-MATCH**
(== baseline — known-broken for Project Server on V19, genuinely suspect on any
TIA-Portal-installed version not in `-VerifiedWorking`), or **NOT-INSTALLED** (TIA Portal V<n> not
installed). It flags a version only if TIA Portal for it is installed AND it is BASELINE-MATCH AND
it is NOT in `-VerifiedWorking`. NOT-INSTALLED versions never cause a failure.

### To resolve a genuinely-suspect version (installed, baseline-match, not working)

1. Smoke-test it first — connect to a Project Server and check projects populate.
2. If it does NOT work ("No projects found"), it needs the fix. For V19 (installed, flat
   `PublicAPI\V19\` layout, no `net48` subfolder) **build targeted** — see [fix-deploy.md](fix-deploy.md).
   For other versions: install the **TIA Portal Openness** option for that version (Siemens
   installer / Control Panel → TIA Portal V<n> → Modify → check "TIA Portal Openness") so
   `PublicAPI\V<n>\net48` appears (or copy `Siemens.Engineering*.dll` into `dotnet/refs/V<n>/`),
   then **build targeted** (`dotnet build ... /p:OpennessTiaMajor=<n>` — never `npm run build:dotnet`,
   which cleans `bin/Release/net48/` first and skips non-`net48` layouts).
3. If the version is **NOT-INSTALLED** (cannot be tested), record it as a Known Limitation — do not
   claim it is fixed or broken.

### Verified state (2026-06-23, user-confirmed)

| Version | TIA Portal | Wrapper DLL (installed author ext.) | Project-server connect | Verdict |
|---|---|---|---|---|
| V18 | not installed (folder absent) | n/a | unverifiable | NOT-INSTALLED |
| V19 | installed | fixed DLL built targeted from fork source (replaces author `FEAC0EE9…`) | **works** (with fix, user-verified 2026-06-23) | FIX REQUIRED + PRESENT |
| V20 | not installed (stub folder: only `Lib/`, no `tiaap.exe`, no `PublicAPI`) | n/a | unverifiable | NOT-INSTALLED |
| V21 | installed | fixed DLL (Multiuser fix), hash `4D59C142…` (short) / `41A930525941E6F2…` (SHA256) | **works** (with fix, user-verified 2026-06-23) | FIX REQUIRED + PRESENT |

The earlier "V19 works without fix" table row (2026-06-19) was retracted. Deploying the fix into
the author extension uses the lighter [fix-deploy.md](fix-deploy.md) workflow: rebuild the fixed
wrapper per version (V21 from the committed DLL, V19 via targeted build because its flat
`PublicAPI\V19\` layout is wrongly skipped by `build-dotnet.js`), co-locate the 15 .NET deps
(incl. the Openness Resolver) alongside the wrapper, and swap with the locked-DLL rename-trick.

## How to re-verify the fix is intact after a sync

```powershell
# The four protected files must still differ from the author baseline (50d1984):
git diff --name-only 50d1984 HEAD -- "dotnet/**/*.cs"
# Expect exactly:
#   .../ConnectionMethodsHandler.cs
#   .../TiaConnectionManager.cs
#   .../TiaConnector.cs
#   .../TiaPortalService.cs

# Multiuser namespace must still be referenced:
Select-String -Path "dotnet/TiaOpennessWrapper/TiaOpennessWrapper.Services/TiaConnectionManager.cs" `
  -Pattern 'Siemens.Engineering.Multiuser'

# Every version's working state accounted for (FIXED / BASELINE-MATCH / NOT-INSTALLED):
pwsh ./.github/skills/tia-fork-sync/scripts/verify-all-versions-fixed.ps1 -VerifiedWorking V19,V21
```

If the source check regresses, the fix was lost — restore the four files from `git` and redo the
merge. If a TIA-Portal-installed version reports `BASELINE-MATCH` and is NOT user-verified-working,
smoke-test it; if it then fails, it needs the fix (see "All-versions fix verification" above). A
`NOT-INSTALLED` version (V18/V20) is unverifiable — record it as a Known Limitation, not as "fixed"
or "broken".
