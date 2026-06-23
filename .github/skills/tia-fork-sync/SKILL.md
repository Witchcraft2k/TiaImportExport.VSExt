---
name: tia-fork-sync
description: "Install the TIA Portal Project Server / multiuser `Tia Connect` fix into the author's freshly-installed TIA Portal Import VS Code extension (Quick Fix Deploy — no VSIX build), for V19 and V21, by rebuilding the fixed .NET wrapper from the fork source and swapping it (with co-located deps + the locked-DLL rename-trick) into the installed extension folder. The deeper full-feature-sync + VSIX path is demoted to an Advanced appendix (used only when an upstream feature must actually work through the wrapper). MemPalace-backed: retrieves fix location + per-version working state before, captures diary/KG facts after. Triggers: 'install the fix', 'deploy project server fix', 'tia fix v19 v21', 'project server fix', 'multiuser tia connect', 'sync fork', 'pull author updates', 'merge installed extension', 'update from VSIX', 'tia fork sync', 'reconcile installed extension', 'fix v19 v20 project server'."
argument-hint: "# default = Quick Fix Deploy (install the fix into the installed extension); the Advanced full-merge+VSIX path is in the appendix"
user-invocable: true
---

# TIA Portal Import — Project Server Fix Deploy (MemPalace-backed)

The **default job** is installing the fork's **Project Server / multiuser** `Tia Connect` fix into the
author's just-installed `TIA Portal Import` VS Code extension so it can load multiuser projects from a
TIA Portal Project Server (the author's published VSIX ships a wrapper built **without** the fix). For
this user the supported versions are **V19 and V21**; V18/V20 are not installed (unverifiable). The
author publishes no full source and no C# wrapper source — only the compiled `out/` JS, `package.json`,
`changelog.md`, and resources via the installed VSIX — so the fix is recovered from **this fork's** C#
source and rebuilt per version.

The skill is **MemPalace-backed**: it retrieves prior sync lessons and the fix's exact location before
starting, and captures durable outcomes (new gotchas, the per-version working state, the deploy
procedure) when done. See [mempalace-integration.md](./references/mempalace-integration.md).

## When to use

- **Default:** user installed a newer `TIA Portal Import` extension and wants *the Project Server fix*
  working on it — follow the **Quick Fix Deploy** procedure below. (V19 and V21 supported.)
- User says "install the fix", "deploy the project server fix", "make my fix work on the new version",
  "/tia-fork-sync".
- **Advanced (appendix below):** the user explicitly wants an upstream feature (e.g. Software Units) to
  actually work through the wrapper — then the full feature merge + VSIX path applies. Do **not** take
  this heavier path by reflex; the deploy path is the default.

## Default mode — Quick Fix Deploy (no VSIX)

The common case is "the author released a newer extension; I just need *my* Project
Server (multiuser `Tia Connect`) fix to work on it, plus V19 and V21 are the versions
I run." That is the **Quick Fix Deploy** procedure below — no full merge, no VSIX build.
It rebuilds the fixed wrapper from the fork source (V21 from the committed DLL,
V19 via a targeted build), co-locates the wrapper's 15 .NET deps alongside it into the
installed author extension folder, and swaps the fixed DLL in with the locked-DLL
rename-trick. Verified working **2026-06-23** on installed `3.0.57` (both V21 and V19).

The deeper **full feature sync + VSIX** path (pulling the author's new JS features into
the fork and shipping a packaged VSIX) is relegated to [§ Advanced](#advanced--full-feature-sync-vsix-build)
at the end — use it **only** when the user wants an upstream feature (e.g. Software
Units) to actually work through the wrapper, not merely load.

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
   binary). ⚠️ For V21/V19, "unchanged" means "no fix" = Project Server connect fails (see fact 7);
   build targeted instead.
7. **VERIFIED STATE (2026-06-23, user-confirmed): the fix is REQUIRED for BOTH V19 and V21.**
   - **V21 — fix REQUIRED and present.** V21 has `PublicAPI\V21\net48` (the nested layout); the V21
     DLL was rebuilt with the fix (git: V21 DLL changed since the v3.0.0 import). V21 project-server
     connect needs the fix and **works with it** (user-verified 2026-06-23 against installed 3.0.57).
   - **V19 — fix REQUIRED (corrected 2026-06-23).** The earlier note (2026-06-19) claiming "V19 works
     without the fix" was a misread: V19 connect **without** the fix enumerates only local projects
     and returns **"No projects found"** against a Project Server — exactly the symptom the fix
     resolves. User-verified 2026-06-23: after building + installing a fixed V19 DLL, V19
     project-server connect works. V19's reference assemblies resolve via the **flat**
     `PublicAPI\V19\Siemens.Engineering.dll` (no `net48` subfolder on V19) — the `.csproj` handles
     this, but `scripts/build-dotnet.js`'s precheck wrongly skips V19 (it looks for
     `PublicAPI\V19\net48`). Build V19 **targeted** (`dotnet build ... /p:OpennessTiaMajor=19`), never
     via `npm run build:dotnet` (which cleans `bin/Release/net48/` and skips V19).
     See [fix-deploy.md](./references/fix-deploy.md).
   - **V18 / V20 — NOT INSTALLED, unverifiable.** V18's `Portal V18` folder is absent; V20's folder
     is a stub (only `Lib/`, no `tiaap.exe`, no `PublicAPI`). Their `bin/.../V18|V20` DLLs are stale
     author binaries but cannot be tested. Do not claim they are "fixed" or "broken" — mark them
     `NOT-INSTALLED / unverifiable` in the changelog and MemPalace.
   - Implication for the gate: the goal is "every version the user runs against a Project Server
     works" — for this user that is **V19 + V21** (both need the fix).
     `verify-all-versions-fixed.ps1` reports FIXED / BASELINE-MATCH / NOT-INSTALLED by hashing against
     the author baseline; note its "BASELINE-MATCH not necessarily broken" assumption is now known to
     be **false for V19** (V19 baseline-match = "No projects found" = needs the fix).
     See [protected-files.md](./protected-files.md) § "All-versions fix verification".
8. **Installing into a running VS Code cannot use `--install-extension` alone.** The active
   extension locks its wrapper DLL and `.node` files, so overwriting in place fails with "being
   used by another process." The working alternative is the **locked-DLL rename-trick**: rename the
   locked file aside (rename touches only the directory entry, not the data the process holds),
   then write the new file under the original name. The in-memory copy only swaps after
   `Developer: Reload Window`. See [fix-deploy.md](./references/fix-deploy.md).

## MemPalace (retrieve before, capture after) — optional, keep light

- **Before:** `mcp_mempalace_mempalace_kg_query(entity="TiaImportExport.VSExt project server fix")`
  loads the fix's file locations and current per-version working state. If the palace has nothing
  yet, skip it — facts 3 + 7 above already encode what matters.
- **After:** write one diary entry (scope / outcome / evidence / unresolved) and, **only if the
  working set changed**, invalidate the old `working_versions` KG fact and add the new one.
  Full contract: [references/mempalace-integration.md](./references/mempalace-integration.md).

## Quick Fix Deploy procedure (default — installs the fix, no VSIX)

Full detail + gotchas + rollback: [references/fix-deploy.md](./references/fix-deploy.md).

1. **Confirm the fix is intact in the fork source** (stop if not):
   ```powershell
   $repo = "<path>\TiaImportExport.VSExt"
   git -C $repo diff --name-only 50d1984 HEAD -- "dotnet/**/*.cs"   # expect 4 files
   Select-String -Path "$repo\dotnet\TiaOpennessWrapper\TiaOpennessWrapper.Services\TiaConnectionManager.cs" -Pattern 'Siemens.Engineering.Multiuser'  # expect 1 hit
   ```
2. **Decide per version** whether a fixed DLL is ready: **V21** = use the committed
   `dotnet/.../bin/Release/net48/V21/TiaOpennessWrapper.dll` (already carries the fix).
   **V19** = the committed DLL is the unfixed author baseline → build targeted in step 2b.
3. **(V19 only) Build a fixed V19 DLL targeted** (bypasses `build-dotnet.js`, which cleans the
   bin/ AND wrongly skips V19's flat `PublicAPI\V19\` layout):
   ```powershell
   dotnet build "$repo\dotnet\TiaOpennessWrapper\TiaOpennessWrapper.csproj" -c Release /p:OpennessTiaMajor=19 -v minimal
   ```
   Expect 0 errors (nullable CS86xx warnings are normal). Output → `bin/Release/net48/V19/`.
4. **For each target version (V19, V21): co-locate deps + swap the fixed wrapper.** Loop below
   co-locates the 15 fork .NET deps (incl. the Openness **Resolver**) and swaps the fixed DLL in
   via the locked-DLL rename-trick:
   ```powershell
   $srcBin = "$repo\dotnet\TiaOpennessWrapper\bin\Release\net48"
   $inst = (Get-ChildItem "$env:USERPROFILE\.vscode\extensions" -Directory -Filter 'mariuszcz*tia-import-*' |
       Sort-Object { [version]($_.BaseName -replace '.*tia-import-','') } -Descending | Select-Object -First 1).FullName
   foreach ($v in 19, 21) {
       $dst = "$inst\dotnet\TiaOpennessWrapper\bin\Release\net48\V$v"; $fixed = "$srcBin\V$v\TiaOpennessWrapper.dll"; $active = "$dst\TiaOpennessWrapper.dll"
       Get-ChildItem "$srcBin\V$v" -File | Where-Object { $_.Name -ne 'TiaOpennessWrapper.dll' -and $_.Name -ne 'TiaOpennessWrapper.pdb' } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $dst $_.Name) -Force }
       Rename-Item -LiteralPath $active -NewName "TiaOpennessWrapper.dll.locked-orig-$(Get-Date -Format yyyy-MM-dd)" -Force -ErrorAction SilentlyContinue
       if (Test-Path $active) { Remove-Item -LiteralPath $active -Force }
       Copy-Item -LiteralPath $fixed -Destination $active -Force
       $hA=(Get-FileHash $active -Algorithm SHA256).Hash; $hF=(Get-FileHash $fixed -Algorithm SHA256).Hash
       Write-Host "V$v match=$($hA -eq $hF) resolver=$(Test-Path "$dst\Siemens.Collaboration.Net.TiaPortal.Openness.Resolver.dll")"
   }
   ```
   Both versions must print `match=True resolver=True`.
5. **Hand off: `Developer: Reload Window`** (mandatory), then with `tiaImport.tiaPortalVersion: 19`
   and `: 21` test `TIA Import: Connect to TIA Portal` against a Project Server — projects must
   populate (V21 first to confirm the pattern, then V19).
6. **Capture** to MemPalace (one diary entry; invalidate+re-add `working_versions` if the set
   changed). Commit the rebuilt V19 DLL: `git add dotnet/TiaOpennessWrapper/bin/Release/net48/V19/ && git commit -m "fix: build Project Server fix into V19 wrapper (targeted)"`.

**Rollback per version:** see [fix-deploy.md](./references/fix-deploy.md) § Rollback.

## Advanced — full feature sync (VSIX build)

Use this path **only** when the user wants an author-side feature (e.g. Software Units) to actually
work through the wrapper — not merely load. The Quick Fix Deploy above intentionally leaves such
features unimplemented (they return `{success:false, error:"Unknown method: <M>"}`, a clean error
not a crash). The full path pulls the author's `out/` JS, merges `package.json`/`changelog`, adds the
missing `.NET` handlers to the fork source, runs `npm run test:method-parity` until green, and ships
a VSIX that overlays the author extension — substantially more depth than the deploy path.

**Do NOT follow this path by reflex.** If asked for the fix to work on a newer extension, the
Quick Fix Deploy procedure above is the answer.

Detailed per-layer steps are in [references/merge-strategy.md](./references/merge-strategy.md). The
short version, in order:

1. `pwsh ./scripts/sync-from-installed.ps1` (dry-run), then `-Apply` to pull `out/`.
2. Structurally merge `package.json` (take installed `version`/`activationEvents`/`contributes.*`).
3. Prepend upstream `changelog.md` entries above the fork's `## [3.0.0]`.
4. Sync new/changed `Documentation/`/`resources/`/`README.md`; preserve fork-local `scripts/` edits.
5. Run `npm run test:method-parity`; for each missing method, **add** a `tiaMethodRouter.Register(...)`
   entry + handler in the matching `*MethodsHandler.cs` (never rewrite the Project Server code).
6. Rebuild wrapper(s): for V21 `npm run build:dotnet`; for V19 build **targeted** (see fix-deploy.md).
7. `pwsh ./scripts/build-and-install.ps1 -BuildOnly` (neutralizes `vscode:prepublish`; VSCE packaged
   **without** `--no-dependencies`; `node_modules/` staged from the installed ext, never `npm install`).
8. `pwsh ./scripts/build-and-install.ps1 -Install` overlays the VSIX onto the running VS Code via the
   rename-trick; `Developer: Reload Window`; smoke-test Connect against a Project Server.
9. `pwsh ./scripts/verify-all-versions-fixed.ps1 -VerifiedWorking V19,V21`; record NOT-INSTALLED
   versions (V18/V20) as `### Known Limitations`; commit.

**Hard rules for the advanced path:** never copy `dotnet/**/bin|obj/**` from the VSIX; never
overwrite the four protected `.cs` files; never package with `--no-dependencies`; never `npm install`
for native deps; always restore `vscode:prepublish` after the VSIX build.

## Hard constraints

- **NEVER** copy `dotnet/**/bin/**` or `dotnet/**/obj/**` from the installed VSIX. Rebuild.
- **NEVER** overwrite `TiaConnector.cs`, `TiaPortalService.cs`, `ConnectionMethodsHandler.cs`, or
  `TiaConnectionManager.cs` (the four protected fix files). Only **add** to them.
- **NEVER** run `npm run build:dotnet` to produce a single version's fixed DLL — it cleans
  `bin/Release/net48/` first (clobbering the V21 fixed DLL + V18/V20 baselines) AND wrongly skips
  V19's flat `PublicAPI\V19\` layout. Build **targeted** (`dotnet build /p:OpennessTiaMajor=<n>`).
- **ALWAYS** co-locate the wrapper's 15 .NET deps (incl. the Openness **Resolver**) alongside the
  fixed DLL in the installed author's `V<n>/` folder. The author's deduped `common/` layout does
  NOT satisfy the fork wrapper's co-located resolution → `Siemens.Collaboration.Net` FileNotFound.
- **ALWAYS** use the locked-DLL rename-trick when swapping a wrapper into a running VS Code; then
  `Developer: Reload Window`.
- **ALWAYS** verify per-version working state with `verify-all-versions-fixed.ps1 -VerifiedWorking V19,V21`.
  Note V19's BASELINE-MATCH is **known-broken** for Project Server ("No projects found"), not "may
  still work" as the script's older wording implied.
- (Advanced path only) **NEVER** package the VSIX with `--no-dependencies`; **NEVER** `npm install`
  native deps (copy `node_modules/` from the installed ext); **ALWAYS** restore `vscode:prepublish`.
- Do **not** hand-edit `.s7dcl`/`.s7res` as SCL, or modify `.tia-cache/` / `TiaExport/` — those are
  regenerated (per repo `AGENTS.md`).
- Keep changes scoped to the deploy; avoid drive-by reformatting of TIA-generated files.
