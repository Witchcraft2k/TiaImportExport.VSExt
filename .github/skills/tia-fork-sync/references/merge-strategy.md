# Merge Strategy — per-layer detail

## Layer: `out/` (compiled JS extension)

**Wholesale replace from the installed VSIX.** No local JS edits exist in the fork
(`git diff 50d1984 HEAD -- out/` is empty), so there is nothing to 3-way merge here.

```
installed VSIX out/**  -->  workspace out/**   (overwrite all)
```

- `scripts/sync-from-installed.ps1 -Apply` does this and only this for `out/`.
- **WORKSPACE-ONLY** `out/` files (in the fork, not in the installed VSIX) are left in place by the
  script. Review them: if upstream dropped them, delete; if they look like fork additions, keep.
- The script **never** touches `dotnet/`.

## Layer: `package.json`

JSON text-merge is fragile; do a **structural key-merge** instead. Take from the installed VSIX:

- `version` — set to the installed version (the sync target).
- `engines.vscode` — take installed (may have moved the minimum).
- `activationEvents` — union, but prefer the installed set (new `onCommand:`/`onLanguageModelTool:`
  entries for new commands/tools). Drop workspace entries for commands that no longer exist.
- `contributes.commands` — take the installed list (titles, icons, `when`). Watch for **new**
  commands, e.g. `tia-import.toggleCliBridge` (3.0.11 "Toggle CLI Bridge").
- `contributes.menus` — take the installed menus (`view/title`, `view/item/context`,
  `commandPalette`, `explorer/context`).
- `contributes.viewsContainers` / `views` / `viewsWelcome` — take installed.
- `contributes.chatParticipants` — take installed.
- `contributes.languageModelTools` — take the installed list (names, `modelDescription`,
  `inputSchema`, `toolReferenceName`). Note any **new** LM tools and their activationEvents.
- `contributes.configuration.properties` — take installed. Pay attention to default changes:
  - `tiaImport.cli.enabled` default flipped `true` → `false` and became hot-reloadable in 3.0.11.
  - Any new settings added upstream.

Keep from the workspace:

- `repository` (the fork's repo URL if it differs).
- Fork-only `scripts` entries (build/release helpers the fork added). Reconcile: take installed's
  script names but keep any fork additions like a custom `package`/`release` if they differ.
- `__metadata` — VS Code install metadata; usually safe to drop or leave as-is.

Validate the result parses: `Get-Content package.json -Raw | ConvertFrom-Json | Out-Null`.

## Layer: `changelog.md`

The workspace tops out at `## [3.0.0]`. Prepend every upstream entry newer than that
(`## [3.0.1]` … `## [3.0.11]`, `## [3.0.12]`, …) **above** the workspace's `## [3.0.0]` block,
preserving the `## [Unreleased]` header if present. Keep the workspace's existing entries below
unchanged. Match the installed file's filename casing (`changelog.md` vs `CHANGELOG.md`); if they
differ, keep the workspace's existing file and just splice the new entries in.

`scripts/sync-from-installed.ps1` reports which upstream entries are missing from the workspace.

## Layer: `Documentation/`, `scripts/`, `resources/`, `Tools/`, `README.md`, `THIRD_PARTY_NOTICES.md`, `.vsixmanifest`

For each, copy files that are **new or changed** in the installed VSIX, unless the workspace copy has
**local git-tracked modifications** (`git status --short` or `git log -- <file>` shows fork
edits) — in that case review and reconcile manually. `.vsixmanifest` typically only needs the
`<Identity Version="...">` and package size updated.

The fork's `Tools/` and `Documentation/Templates/Tools/` Python helpers
(`_extractHMI.py`, `_setStartValueHMI.py`) are workspace-local; do not let an upstream copy clobber
fork edits to them.

## Layer: `dotnet/` (.NET wrapper — the fix)

**Source: workspace only. Never copy from VSIX.**

1. After `out/` is synced, run `npm run test:method-parity`.
2. For every method the synced JS calls that is **not** registered, add:
   - a handler method in the matching `*MethodsHandler.cs` (e.g.
     `ConnectionMethodsHandler.cs`, `HardwareMethodsHandler.cs`,
     `SoftwareExportMethodsHandler.cs`, `ImportAndMaintenanceMethodsHandler.cs`,
     `HmiMethodsHandler.cs`), and
   - a `tiaMethodRouter.Register("MethodName", handler.MethodName)` line in `TiaConnector.cs`.
3. Use the **exact** method name string the JS passes to `callDotNet`/`safeCall`.
4. Preserve all `Siemens.Engineering.Multiuser` / Project Server code — see
   [protected-files.md](./protected-files.md).
5. Rebuild: for V21 `npm run build:dotnet` works (nested `PublicAPI\V21\net48` matches the
   script's precheck). For V19 its flat `PublicAPI\V19\` (no `net48` subfolder) is wrongly **skipped**
   by `build-dotnet.js` — build V19 **targeted** (`dotnet build … /p:OpennessTiaMajor=19`). ⚠️ Do NOT
   rely on "skipped = fine": V19 with the author DLL returns **"No projects found"** against a
   Project Server (user-verified 2026-06-23) — it needs the fix.
6. **Verify the per-version working state** (see § "All-versions fix verification" below).
7. Re-run `npm run test:method-parity` until green.

### All-versions fix verification (goal: "every version the user runs works")

The fix lives in **shared C# source with no `#if V18/V19/V20/V21` conditionals**, so a rebuild
fixes every version **that actually gets built**. `build-dotnet.js` skips versions lacking the
nested `PublicAPI\V<n>\net48` directory, leaving their DLL unchanged.

⚠️ **The fix is required by BOTH V19 and V21** (corrected 2026-06-23). V19 connect with the
author's unfixed DLL returns **"No projects found"** against a Project Server (exactly the symptom
the fix resolves). So "DLL == author baseline" DOES mean "broken for Project-Server use" — do NOT
assume a skipped version is still working. Build skipped-but-installed versions **targeted**
(bypassing `build-dotnet.js` which also `cleanOutputRoot()`s first).

Verify with:

```powershell
pwsh ./scripts/verify-all-versions-fixed.ps1 -VerifiedWorking V19,V21
```

It hashes each `V18/V19/V20/V21` `TiaOpennessWrapper.dll` against the author baseline (commit
`50d1984`, the v3.0.0 import) and reports:
- **FIXED** — differs from author baseline (rebuilt with the fix).
- **BASELINE-MATCH** — == author baseline (no fix). For V19 this is **known-broken** for Project-Server
  use ("No projects found", 2026-06-23); for other installed versions it is genuinely suspect.
  Flagged when TIA Portal for that version IS installed AND it is NOT in `-VerifiedWorking`.
- **NOT-INSTALLED** — TIA Portal V<n> not installed (folder absent or stub); unverifiable.

It flags a version only if TIA Portal for it is installed AND it is BASELINE-MATCH AND it is NOT in
`-VerifiedWorking` (genuinely suspect). To resolve a flagged version:

- **Smoke-test first** (`tiaImport.tiaPortalVersion: <n>` → connect to a Project Server). If it
  works (projects populate), add it to `-VerifiedWorking`.
- If it does NOT work ("No projects found"), it needs the fix. For V19 (installed, flat
  `PublicAPI\V19\` layout) build **targeted** — see [fix-deploy.md](fix-deploy.md). For other
  versions: install the TIA Portal Openness option so `PublicAPI\V<n>\net48` appears (or copy
  `Siemens.Engineering*.dll` into `dotnet/refs/V<n>/`), then build targeted
  (`dotnet build … /p:OpennessTiaMajor=<n>` — never `npm run build:dotnet`, which cleans
  `bin/Release/net48/` first).
- **NOT-INSTALLED** versions are a known limitation — record in changelog `### Known Limitations` +
  MemPalace as "unverifiable (TIA Portal not installed)". Do not claim fixed or broken.

**Verified 2026-06-23 state (user-confirmed):**
- V21 — FIXED, fix required + present, works.
- V19 — FIXED via targeted build, fix required + present, works (corrected from the 2026-06-19
  "works without fix" note — that was a misread; V19 baseline returns "No projects found").
- V18 — NOT-INSTALLED (folder absent), unverifiable.
- V20 — NOT-INSTALLED (stub folder: only `Lib/`, no executable, no `PublicAPI`), unverifiable.

## Layer: `node_modules/` (runtime native deps)

**Copy wholesale from the installed extension. Do NOT `npm install`.**

```
installed ext node_modules/**  -->  workspace node_modules/**   (overwrite all)
```

The extension depends on `edge-js`, `electron-edge-js`, `xml2js` + transitive (`edge-cs`, `nan`,
`sax`, `xmlbuilder`). These include **native `.node` binaries matched to the running VS Code's
Electron**. `npm install` can pull incompatible natives; copying from the installed extension
preserves the validated set. Verify the tree: `npm ls --production --depth=0` (expect exit 0:
`edge-js`, `electron-edge-js`, `xml2js` all resolved). `node_modules/` is build-only — do not commit
it (no `.gitignore` exists in this workspace, so be explicit at commit time).

## Layer: VSIX build

`npm run package` runs `vscode:prepublish` → `npm run build:dotnet && npm run compile`, which is
**unsafe in this compiled-only workspace** (no `src/`, no `tsconfig.json`; `build:dotnet` would
overwrite the fixed DLL). Build via `scripts/build-and-install.ps1 -BuildOnly` which:

1. Stages `node_modules/` from the installed extension (see layer above).
2. Temporarily sets `vscode:prepublish` to an echo (skipping `build:dotnet`/`compile`/version-bump).
3. Runs `npx @vscode/vsce package` **WITHOUT `--no-dependencies`**.
   - ⚠️ `--no-dependencies` drops the entire `node_modules/` subtree → VSIX has no native deps →
     extension fails to load with "Cannot find module". Without the flag, vsce runs
     `npm ls --production` (read-only) against staged `node_modules` and includes production deps; it
     does **not** run `npm install`.
4. Restores `vscode:prepublish` to its original value.
5. Hashes the fixed-version DLL entries inside the VSIX against the workspace DLLs to confirm the
   fix shipped.

## Layer: Install — overlay into the running VS Code

`code --install-extension x.vsix --force` **fails on a running VS Code** with
`EPERM ... Please restart VS Code`: the active extension locks its native `.node` files and the
extension folder cannot be renamed. Two install paths:

- **Overlay install (works while VS Code runs):** `scripts/install-overlay.ps1` extracts the VSIX
  over `~/.vscode/extensions/mariuszcz...tia-import-<v>/`, skips `node_modules/` (identical, avoids
  touching loaded natives), and for locked files uses the **rename-trick**: rename the locked file to
  `<name>.locked-orig` (rename touches only the directory entry, not the data the process holds),
  then write the new file under the original name. Author originals preserved as `*.locked-orig`.
  The in-memory DLL only swaps after `Developer: Reload Window`.
- **Standard install (requires VS Code fully quit):** close all VS Code windows, then
  `code --install-extension x.vsix --force`, then relaunch. Use `scripts/install-test-vsix.cmd` at
  the repo root (loops until VS Code is closed, installs, relaunches).

`scripts/build-and-install.ps1 -Install` does build (VSIX) + overlay install in one shot.

## Validation gates (run in order, stop on failure)

```powershell
npm run test:method-parity   # JS methods <-> TiaConnector.cs registry
npm run test:unit            # mocha (if present)
npm run build:dotnet         # C# compiles with the fix intact
pwsh ./scripts/verify-all-versions-fixed.ps1 -VerifiedWorking V19,V21   # per-version working state
```

Then `Developer: Reload Window` and smoke-test Connect against a **Project Server** multiuser
project. Smoke-test each version you ship: V21 (fix required, works with fix) and V19 (works without
fix). V18/V20 are not installed — mark `### Known Limitations`.

## Version + commit

- Set `package.json` `version` to the installed VSIX version.
- Update the changelog; note any versions still lacking the fix under `### Known Limitations`.
- `git add -A` but **exclude `node_modules/`** and the built `.vsix` (build artifacts):
  `git add out/ package.json CHANGELOG.md Documentation/ dotnet/ scripts/ ...`
- `git commit -m "Merge upstream VSIX vX.Y.Z into project-server-fixed fork (fix: V21; V18/V19/V20 pending Openness PublicAPI)"`.
