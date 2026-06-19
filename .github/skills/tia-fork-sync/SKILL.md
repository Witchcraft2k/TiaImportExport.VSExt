---
name: tia-fork-sync
description: "Sync this TIA Portal Import fork with the author's latest published VSIX and ship it with the TIA Portal Project Server / multiuser Tia Connect fix. Use when pulling author updates from the installed VS Code extension into the workspace fork; merging out/ compiled JS, package.json, changelog from the installed extension; preserving and rebuilding the .NET wrapper project-server fix across ALL TIA versions (V18/V19/V20/V21); building and installing the VSIX (overlay-install into a running VS Code via the locked-DLL rename-trick); validating JS↔.NET method parity; and capturing/retrieving sync lessons through MemPalace. Triggers: 'sync fork', 'pull author updates', 'merge installed extension', 'update from VSIX', 'tia fork sync', 'project server fix', 'multiuser tia connect', 'reconcile installed extension', 'build vsix', 'install extension', 'fix v19 v20 project server', 'rebuild wrapper all versions'."
argument-hint: "[-Apply]  # dry-run by default; add -Apply to copy out/ files from the installed VSIX"
user-invocable: true
---

# TIA Portal Import — Fork Sync, Build & Install (MemPalace-backed)

Syncs **this fork** (workspace, carries the TIA Portal **Project Server / multiuser** `Tia Connect` fix)
with the **author's latest published extension** that is installed in VS Code, then **builds and
installs** the merged result so the fix ships with the author's newest features. The author does not
publish the full source on GitHub, so upstream changes are recovered from the **installed VSIX**
(`~/.vscode/extensions/mariuszcz...tia-import-<version>/`), which ships the compiled `out/` JS, the
`package.json`, the `changelog.md` and resources — but **not** the C# wrapper source.

This skill is **MemPalace-backed**: it retrieves prior sync lessons and the fix's exact location
before starting, and captures durable outcomes (new gotchas, the all-versions fix state, install
procedures) when done. See [mempalace-integration.md](./references/mempalace-integration.md).

## When to use

- After installing a newer `TIA Portal Import` extension and you want its changes in your fork.
- User says "pull the changes from the installed version", "sync my fork with the author's update",
  "merge the VSIX into my project-server-fixed version", "/tia-fork-sync".
- Before any release that must include both the author's latest features and the Project Server fix.

## Verified facts about this fork (do NOT rediscover — rely on these)

1. **No TypeScript source exists in the workspace.** `out/` (compiled JS) is the source of truth for
   the extension layer. `package.json` references `src` in `lint`, but there is no `src/` — the
   author's TS was never published. Edit `out/*.js` directly.
2. **`out/` at `HEAD` is byte-identical to the author's v3.0.0 import.** Verified via
   `git diff 50d1984 HEAD -- out/` (empty). The project-server fix is **not** in the JS layer, so
   `out/` can be replaced wholesale from the installed VSIX with **zero risk** to the fix.
3. **The Project Server / multiuser `Tia Connect` fix lives entirely in the .NET wrapper C# source**
   (4 files): `TiaConnector.cs`, `TiaPortalService.cs`, `ConnectionMethodsHandler.cs`,
   `TiaConnectionManager.cs`. The installed VSIX contains only **compiled DLLs** for these — never
   copy `dotnet/**/bin/**` or `dotnet/**/obj/**` from the VSIX. Rebuild from the fixed source instead.
   See [protected-files.md](./references/protected-files.md).
4. **Method-parity gate.** `npm run test:method-parity` cross-checks every `callDotNet('M')` /
   `safeCall('label','M')` in `out/services/bridge/*.js` against `tiaMethodRouter.Register("M")` in
   `TiaConnector.cs`. After syncing `out/`, run it — any new author-side .NET calls surface here and
   must be answered by **adding** handlers to the C# source (preserving the fix), not by copying DLLs.
5. **Workspace `package.json` version is behind** the installed one. The installed VSIX is the
   upstream version target.
6. **The Project Server fix is in SHARED C# source — no `#if V18/V19/V20/V21` conditionals.**
   `TiaConnectionManager.cs` carries `using Siemens.Engineering.Multiuser;` and the project-server
   enumeration logic. `build:dotnet` compiles **each** version from that same source, so a clean
   rebuild *would* fix all versions — **but only for versions whose Openness reference assemblies are
   available**. `scripts/build-dotnet.js` skips any version whose
   `C:\Program Files\Siemens\Automation\Portal V<n>\PublicAPI\V<n>\net48` **directory** is missing
   (it checks the dir, not a specific DLL — the folder holds `Siemens.Engineering.Base.dll` etc.),
   or the `dotnet/refs/V<n>` fallback. A skipped version's DLL is **left unchanged** (the pre-fix
   binary). ⚠️ Unchanged ≠ broken — V19 works with the unchanged author DLL (see fact 7).
7. **VERIFIED STATE (2026-06-19, user-confirmed): the fix is V21-SPECIFIC. V19 works WITHOUT it.**
   - **V21 — fix REQUIRED and present.** Only V21 has `PublicAPI\V21\net48`; the V21 DLL was rebuilt
     with the fix (git: only V21 DLL changed since the v3.0.0 import). V21 project-server connect
     needs the fix and works with it.
   - **V19 — works WITHOUT the fix.** User-verified 2026-06-19 with `tiaImport.tiaPortalVersion: 19`:
     project-server connect works using the **author's unfixed V19 DLL** (workspace == installed ==
     author baseline, hash `FEAC0EE9…`). Do NOT treat V19 as "needs fixing" — it doesn't. Rebuilding
     V19 with the fix is unnecessary (and currently impossible: no `PublicAPI\V19\net48`).
   - **V18 / V20 — NOT INSTALLED, unverifiable.** V18's `Portal V18` folder is absent; V20's folder
     is a stub (only `Lib/`, no `tiaap.exe`, no `PublicAPI`). Their `bin/.../V18|V20` DLLs are stale
     author binaries but cannot be tested. Do not claim they are "fixed" or "broken" — mark them
     `NOT-INSTALLED / unverifiable` in the changelog and MemPalace.
   - Implication for the gate: "every version DLL carries the fix" is **NOT** the goal. The goal is
     "every version the user runs against a project server works". Verify with
     `verify-all-versions-fixed.ps1 -VerifiedWorking V19,V21` (it reports FIXED / BASELINE-MATCH /
     NOT-INSTALLED and only flags a TIA-Portal-installed version that is baseline-match AND not
     user-verified-working). See [protected-files.md](./protected-files.md) § "All-versions fix
     verification".
8. **Installing into a running VS Code cannot use `--install-extension` alone.** The active
   extension locks its native `.node` files and the extension folder cannot be renamed, so
   `code --install-extension x.vsix --force` fails with `EPERM ... Please restart VS Code`. The
   working alternative is the **overlay install**: extract the VSIX directly over the installed
   extension folder, using the Windows **rename-trick** for locked files (rename the locked file
   aside — rename only touches the directory entry, not the data the process holds — then write the
   new file under the original name). The in-memory copy only swaps after
   `Developer: Reload Window`. See [merge-strategy.md](./references/merge-strategy.md) § "Install".

## MemPalace integration (retrieve before, capture after)

This skill is MemPalace-backed. The retrieve/capture contract is detailed in
[mempalace-integration.md](./references/mempalace-integration.md); the short form:

- **Before syncing (RETRIEVE):** query the MemPalace knowledge graph for `TiaImportExport.VSExt` and
  `TIA Portal Project Server fix` to load the fix's location, the current all-versions fix state, and
  any prior-sync gotchas (e.g. the `--no-dependencies` VSIX pitfall, the locked-DLL rename-trick).
  Do not rediscover what is already filed.
- **After syncing (CAPTURE):** write a diary entry (scope / durable outcome / evidence / unresolved
  edge), update knowledge-graph facts if the all-versions fix state changed, and file any new durable
  procedure as a drawer (verbatim, recoverable). Skip anything ephemeral or duplicated.

## Per-layer strategy (detail in [merge-strategy.md](./references/merge-strategy.md))

| Layer | Source | Action |
|-------|--------|--------|
| `out/` (compiled JS) | installed VSIX | **Wholesale replace** — no local edits exist. Copy all installed `out/` files over the workspace; report (do not auto-delete) files that exist only in the workspace. |
| `package.json` | installed VSIX | **Structural key-merge** — take installed `version`, `activationEvents`, `contributes.commands/menus/languageModelTools/chatParticipants/configuration`. Preserve workspace-only keys (none expected beyond repo metadata). Reconcile `scripts`/`devDependencies`/`dependencies` carefully (workspace may pin local build scripts). |
| `changelog.md` | installed VSIX | **Prepend** installed's newer entries (e.g. 3.0.1–3.0.12) above the workspace's `## [3.0.0]` block; keep the workspace's project-server-fix note if present. Match the installed file's casing (`changelog.md` vs `CHANGELOG.md`). |
| `Documentation/`, `scripts/`, `resources/`, `Tools/`, `README.md`, `THIRD_PARTY_NOTICES.md`, `.vsixmanifest` | installed VSIX | Copy **new/changed** files; skip files with local git-tracked modifications (review those manually). |
| `dotnet/` C# source (the fix) | **workspace only** | **Never overwrite from VSIX.** Only **add** new `tiaMethodRouter.Register(...)` handlers / method-router entries the synced JS requires. Preserve all `Siemens.Engineering.Multiuser` / Project Server code. |
| `dotnet/**/bin/**`, `dotnet/**/obj/**` | **rebuilt, never copied** | Run `npm run build:dotnet` to recompile the fixed wrapper. Only versions with Openness PublicAPI refs are built; the rest keep their existing DLL. Note: a version keeping the author DLL is **not necessarily broken** — V19 works with the author DLL (fact 7). Verify working state, don't assume "no fix = broken". |
| `node_modules/` (runtime native deps) | installed VSIX | **Copy wholesale from the installed extension** (`edge-js`, `electron-edge-js`, `xml2js` + transitive). Do NOT `npm install` — it can pull incompatible native binaries. Validate with `npm ls --production`. |
| VSIX build | workspace | `npx @vscode/vsce package` (WITHOUT `--no-dependencies`, which wrongly drops `node_modules/`). Neutralize `vscode:prepublish` first (it runs `build:dotnet && compile` — would overwrite the fixed DLL / fail on missing `tsconfig.json`). Restore it after. |
| Installed extension folder | VSIX contents | **Overlay install** (extract VSIX over `~/.vscode/extensions/mariuszcz...tia-import-<v>/`), rename-trick for locked files, skip `node_modules/` if identical. Then `Developer: Reload Window`. |

## Procedure

### 0. RETRIEVE — load prior context from MemPalace (do this first)

Before touching files, query MemPalace so you do not rediscover known facts:

```text
mcp_mempalace_mempalace_kg_query(entity="TiaImportExport.VSExt")
mcp_mempalace_mempalace_kg_query(entity="TIA Portal Project Server fix")
mcp_mempalace_mempalace_list_drawers(wing="tia-portal", room="fork-sync")   # prior sync lessons
```

Load: the fix's exact file locations, the current all-versions fix state (which of V18/V19/V20/V21
are fixed), and any prior-sync gotchas (the `--no-dependencies` VSIX pitfall, the locked-DLL
rename-trick, the Openness-PublicAPI-missing skip). If the palace has nothing yet, proceed and
CAPTURE at the end (step 12).

### 1. Confirm installed extension + dry-run diff

Run the bundled helper (dry-run by default):

```powershell
pwsh ./scripts/sync-from-installed.ps1
```

It auto-detects the highest-version `mariuszcz...tia-import-*` folder under
`~/.vscode/extensions`, classifies every `out/` file as `NEW` / `CHANGED` / `IDENTICAL` /
`WORKSPACE-ONLY`, and reports `package.json` + `changelog` deltas. **Read the report before
applying anything.**

### 2. Sync the JS layer (`out/`)

Apply the wholesale `out/` replacement:

```powershell
pwsh ./scripts/sync-from-installed.ps1 -Apply
```

This copies every `out/**` file from the installed VSIX into the workspace `out/`. It **never**
touches `dotnet/`. Workspace-only `out/` files are listed but left in place — review them: if the
author removed them upstream, delete them; if they look like local additions, keep them.

### 3. Merge `package.json`

Open workspace `package.json` and the installed one side by side. Apply the installed values for:
`version`, `engines.vscode`, `activationEvents`, `contributes.commands` (titles/icons/`when`),
`contributes.menus`, `contributes.viewsContainers`/`views`/`viewsWelcome`,
`contributes.chatParticipants`, `contributes.languageModelTools` (names, modelDescriptions,
inputSchemas), and `contributes.configuration.properties` (defaults — note the 3.0.11 change making
`tiaImport.cli.enabled` default `false` and hot-reloadable; the new `TIA Import: Toggle CLI Bridge`
command). Validate JSON after editing.

Keep workspace-specific bits: `repository`, `__metadata` (usually safe to drop), and any local
`scripts` entries the fork added. **Do not** let the merge pull in `vscode:prepublish` changes that
would run `build:dotnet && compile` at package time in a compiled-only workspace — see step 9.

### 4. Merge `changelog.md`

Prepend the installed extension's entries newer than the workspace's top entry (the workspace tops
out at `## [3.0.0]`). Keep the workspace's existing entries below. If the workspace carries a
project-server-fix changelog note, preserve it (optionally under a `### Fixed` sub-entry).

### 5. Sync resources, docs, scripts

For `Documentation/`, `scripts/`, `resources/`, `Tools/`, `README.md`, `THIRD_PARTY_NOTICES.md`,
`.vsixmanifest`: copy files that are new or changed in the installed VSIX, unless the workspace copy
has local git-tracked edits — in that case review and manually reconcile. `.vsixmanifest` usually
only needs the version + size updated.

### 6. Rebuild the .NET wrapper from the fixed source

```powershell
npm run build:dotnet
```

This recompiles `TiaOpennessWrapper.dll` **from the workspace C# source** (which still contains the
Project Server / multiuser fix) for every version whose Openness PublicAPI refs are available.
**Do not** copy `dotnet/**/bin/**` from the VSIX. Versions whose `PublicAPI\V<n>\net48` is missing
are **skipped** — their DLL keeps the existing binary. ⚠️ A skipped version is **not necessarily
broken**: V19 works with the author DLL (fact 7). Step 7 determines which versions actually need
attention.

### 7. VERIFY which versions work (the goal is "working", not "every DLL has the fix")

The fix is **V21-specific** (fact 7): V21 requires it; V19 works without it; V18/V20 are not
installed. So the gate is NOT "every version DLL carries the fix" — it is "every version the user
runs against a project server works". Run the bundled verifier, passing the versions you have
confirmed working via smoke-test:

```powershell
# -VerifiedWorking lists versions confirmed working by user smoke-test (default: V19,V21).
pwsh ./scripts/verify-all-versions-fixed.ps1 -VerifiedWorking V19,V21
```

It reports each version as one of:
- **FIXED** — DLL differs from the author baseline (rebuilt with the fix; e.g. V21).
- **BASELINE-MATCH** — DLL == author baseline (no fix). May still work (V19 does) or may need the
  fix. Flagged only if TIA Portal for that version is installed AND it is NOT in `-VerifiedWorking`.
- **NOT-INSTALLED** — TIA Portal V<n> not installed (folder absent, or a stub with no executable);
  cannot be verified. Never causes a failure.

**If a TIA-Portal-installed version is BASELINE-MATCH and NOT user-verified-working** (genuinely
suspect), the script exits non-zero. To resolve:
- Smoke-test it: set `tiaImport.tiaPortalVersion: <n>`, connect to a Project Server, list/select a
  project. If it works, add it to `-VerifiedWorking` and record it in MemPalace (step 12).
- If it does NOT work and needs the fix: install the TIA Portal **Openness (PublicAPI)** option for
  that version (Siemens installer → Modify → "TIA Portal Openness") so `PublicAPI\V<n>\net48`
  appears, then re-run `npm run build:dotnet`; or copy `Siemens.Engineering*.dll` reference
  assemblies into `dotnet/refs/V<n>/` and rebuild.
- **NOT-INSTALLED** versions (V18/V20 here) are a known limitation — record them in the changelog's
  `### Known Limitations` and MemPalace as "unverifiable (TIA Portal not installed)". Do NOT claim
  they are fixed or broken.

### 8. Validate — the gates that prove the merge is correct

Run in order; stop and fix on any failure:

```powershell
npm run test:method-parity   # JS callDotNet/safeCall methods ↔ TiaConnector.cs tiaMethodRouter.Register
npm run test:unit            # mocha unit tests (if applicable to this compiled-only workspace)
npm run build:dotnet         # confirms C# compiles with the fix intact
```

- **`test:method-parity` failures** = the synced JS calls .NET methods not registered in
  `TiaConnector.cs`. Fix by **adding** `tiaMethodRouter.Register("MissingMethod", handler.Method)`
  entries + the handler method in the appropriate `*MethodsHandler.cs` (e.g.
  `ConnectionMethodsHandler.cs`). Mirror the author's method names exactly. **Never delete or
  rewrite** the existing Project Server / multiuser connection code to do this — append alongside it.
- Re-run the parity test until green.

### 9. Build the VSIX

This workspace is **compiled-only** (no `src/`, no `tsconfig.json`), so the standard
`npm run package` (which triggers `vscode:prepublish` → `build:dotnet && compile`) must be adapted.
Use the orchestrator, which neutralizes `vscode:prepublish` for the build then restores it:

```powershell
pwsh ./scripts/build-and-install.ps1 -BuildOnly
```

What it does (and why):

1. **Stage `node_modules/`** by copying it from the installed extension (validated native binaries:
   `edge-js`, `electron-edge-js`, `xml2js`). Do NOT `npm install` — it can pull incompatible
   natives. Verify with `npm ls --production`.
2. **Temporarily neutralize `vscode:prepublish`** (set to an echo) so the build does not run
   `build:dotnet` (would overwrite the fixed DLL) or `compile` (would fail: no `tsconfig.json`) or
   the version bump.
3. **`npx @vscode/vsce package`** — WITHOUT `--no-dependencies`. ⚠️ `--no-dependencies` silently
   drops the entire `node_modules/` subtree, producing a VSIX with no runtime native deps that fails
   to load with "Cannot find module". Without the flag, vsce runs `npm ls --production` (read-only)
   against the staged `node_modules` and includes production deps — it does **not** run
   `npm install`, so the validated binaries stay intact.
4. **Restore `vscode:prepublish`** to its original value.
5. Verify the fixed V21 (and any other fixed-version) DLL is inside the VSIX by hashing the zip
   entry against the workspace DLL.

### 10. Install — overlay into the running VS Code

`code --install-extension x.vsix --force` fails on a running VS Code (`EPERM ... Please restart VS
Code`) because the active extension locks its native files and the extension folder cannot be
renamed. Use the overlay installer instead:

```powershell
pwsh ./scripts/build-and-install.ps1 -Install   # builds (step 9) then overlays
# or, if the VSIX is already built:
pwsh ./scripts/install-overlay.ps1 -Vsix .\tia-import-<ver>.vsix
```

The overlay installer extracts the VSIX directly over
`~/.vscode/extensions/mariuszcz...tia-import-<v>/`, **skips `node_modules/`** if identical (avoids
touching any loaded natives), and for any **locked** file uses the **rename-trick**: rename the
locked file to `<name>.locked-orig` (rename only touches the directory entry, not the data the
process holds), then write the new file under the original name. The author's originals are
preserved as `*.locked-orig` backups.

### 11. Reload + smoke-test

The running extension host still holds the **old** DLL in memory — the on-disk replacement only
takes effect after a host restart. Run `Developer: Reload Window` (or `Ctrl+Shift+P` →
`Reload Window`). Then verify:

- The `TIA Portal Import` activity bar view loads.
- `TIA Import: Connect to TIA Portal` works against a **Project Server** multiuser project (the
  whole point of the fork) — connect, list projects, select one. Use the **V21** wrapper
  (`tiaImport.tiaPortalVersion: 21`) since that is the version currently carrying the fix.
- A new author feature from the synced version works (e.g. the `CLI Bridge` toggle if 3.0.11+).

### 12. CAPTURE — file durable outcomes to MemPalace

After the sync+build+install, capture what future runs should not rediscover. Follow the
mempalace-capture storage rules (drawer = verbatim procedure, KG = stable fact, diary = session
compression). Concretely:

```text
# Diary (always): scope / durable outcome / evidence / unresolved edge
mcp_mempalace_mempalace_diary_write(agent_name="tia-fork-sync",
  entry="scope:sync-fork-3.0.12|outcome:js-merged+vsix-built+overlay-installed|evidence:method-parity-46/46+v21-fixed+v19-works-without-fix|unresolved:v18/v20-not-installed-unverifiable")

# Knowledge graph (only if the all-versions working state changed). Invalidate the old fact first:
mcp_mempalace_mempalace_kg_invalidate(subject="TiaImportExport.VSExt project server fix",
  predicate="fixed_in_versions", object="<previous object string>", ended="<date>")
mcp_mempalace_mempalace_kg_add(subject="TiaImportExport.VSExt project server fix",
  predicate="working_versions", object="V21 (fix required+present); V19 (works without fix, user-verified); V18/V20 not installed",
  valid_from="2026-06-19")

# Drawer (only for a NEW durable procedure, after a duplicate check)
mcp_mempalace_mempalace_check_duplicate(content=<the new procedure>)
mcp_mempalace_mempalace_add_drawer(wing="tia-portal", room="fork-sync",
  content=<verbatim procedure>, source_file=<path>)
```

Skip capture if the memory is ephemeral, duplicated, or speculative. Reuse the `tia-portal` wing and
`fork-sync` / `project-server-fix` rooms rather than creating near-duplicates.

### 13. Version bump + commit

Set `package.json` `version` to the installed VSIX's version (the helper prints it). Update
`CHANGELOG.md` (record the per-version working state under `### Known Limitations` for any
NOT-INSTALLED versions, e.g. "V18/V20: TIA Portal not installed — Project Server connect
unverifiable; use V19 or V21"). Then:

```powershell
git add -A
git commit -m "Merge upstream VSIX vX.Y.Z into project-server-fixed fork"
```

Use a clear message that names the upstream version, explicitly states the Project Server fix was
preserved, and lists the working state (e.g. "fix required+present for V21; V19 works without fix
(user-verified); V18/V20 not installed — unverifiable").

## Hard constraints

- **NEVER** copy `dotnet/**/bin/**` or `dotnet/**/obj/**` from the installed VSIX. Rebuild.
- **NEVER** overwrite `TiaConnector.cs`, `TiaPortalService.cs`, `ConnectionMethodsHandler.cs`, or
  `TiaConnectionManager.cs` from the VSIX (the VSIX has no source anyway). Only **add** to them.
- **NEVER** package the VSIX with `--no-dependencies` — it silently drops `node_modules/` and the
  extension fails to load with "Cannot find module".
- **NEVER** run `npm install` to stage `node_modules/` — copy it from the installed extension so the
  validated native binaries (`edge-js`/`electron-edge-js`) are preserved.
- **ALWAYS** verify the per-version working state (step 7) after `build:dotnet`. The goal is
  "every version the user runs works", NOT "every DLL carries the fix" — V19 works without the fix
  (fact 7). Use `verify-all-versions-fixed.ps1 -VerifiedWorking <confirmed versions>`. Record
  NOT-INSTALLED versions (V18/V20) as `### Known Limitations` (unverifiable), not as "broken".
- **ALWAYS** restore `vscode:prepublish` to its original value after the VSIX build.
- Do **not** hand-edit `.s7dcl`/`.s7res` as SCL, or modify `.tia-cache/` / `TiaExport/` — those are
  regenerated (per repo `AGENTS.md`).
- Keep changes scoped to the sync; avoid drive-by reformatting of TIA-generated files.
