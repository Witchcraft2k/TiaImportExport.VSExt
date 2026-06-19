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

⚠️ The Project Server fix is **V21-specific**. Empirically (user-verified 2026-06-19), V19's
project-server connect **works with the author's unfixed DLL** — V19 does NOT need the fix. So a
version whose DLL matches the author baseline is **not necessarily broken**. Do NOT assume
"baseline-match = needs fixing". Verify by smoke-test (`tiaImport.tiaPortalVersion: <n>` → connect
to a Project Server → list/select project).

### Verify after every build

```powershell
pwsh ./.github/skills/tia-fork-sync/scripts/verify-all-versions-fixed.ps1 -VerifiedWorking V19,V21
```

It reports each version as **FIXED** (differs from author baseline `50d1984`), **BASELINE-MATCH**
(== baseline; may still work — V19 does), or **NOT-INSTALLED** (TIA Portal V<n> not installed).
It flags a version only if TIA Portal for it is installed AND it is BASELINE-MATCH AND it is NOT in
`-VerifiedWorking` (genuinely suspect). NOT-INSTALLED versions never cause a failure.

### To resolve a genuinely-suspect version (installed, baseline-match, not working)

1. Smoke-test it first — it may work without the fix (like V19).
2. If it does NOT work and needs the fix: install the **TIA Portal Openness** option for that
   version (Siemens installer / Control Panel → TIA Portal V<n> → Modify → check "TIA Portal
   Openness") so `PublicAPI\V<n>\net48` appears, then `npm run build:dotnet`; or copy
   `Siemens.Engineering*.dll` into `dotnet/refs/V<n>/` and re-run the build.
3. If the version is **NOT-INSTALLED** (cannot be tested), record it as a Known Limitation — do not
   claim it is fixed or broken.

### Verified state (2026-06-19, user-confirmed)

| Version | TIA Portal | Wrapper DLL | Project-server connect | Verdict |
|---|---|---|---|---|
| V18 | not installed (folder absent) | stale author DLL | unverifiable | NOT-INSTALLED |
| V19 | installed | author DLL (no fix), hash `FEAC0EE9…` | **works** (`tiaPortalVersion: 19`) | WORKS WITHOUT FIX |
| V20 | not installed (stub folder: only `Lib/`, no `tiaap.exe`, no `PublicAPI`) | stale author DLL | unverifiable | NOT-INSTALLED |
| V21 | installed | fixed DLL (Multiuser fix), hash `4D59C142…` | **works** (with fix) | FIX REQUIRED + PRESENT |

Only `V21/TiaOpennessWrapper.dll` appears in `git diff 50d1984 HEAD -- dotnet/**/bin/**`. The V19
DLL is byte-identical to the author baseline across workspace / installed extension / git, yet V19
works — confirming the fix is not required for V19.

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
