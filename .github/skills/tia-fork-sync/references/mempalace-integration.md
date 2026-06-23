# MemPalace Integration — retrieve before, capture after

This skill is **MemPalace-backed**. MemPalace is the persistent memory store (drawers = verbatim
content, knowledge graph = stable facts, diary = session compression). The integration has two
phases wrapped around the sync procedure: **RETRIEVE** before touching files, **CAPTURE** after the
install succeeds. The goal is that future syncs do not rediscover what is already known.

## Storage map for this skill

| Memory shape | Store as | Wing / Room | Notes |
|---|---|---|---|
| The fix's file locations + all-versions state | Knowledge graph facts | — (entity-scoped) | Atomic: one subject, one predicate, one object. |
| A verbatim sync/install procedure or gotcha | Drawer | `tia-portal` / `fork-sync` or `project-server-fix` | Verbatim, recoverable. Duplicate-check first. |
| What happened in this sync session | Diary entry | `wing_tia-fork-sync` (agent diary) | AAAK-compressed: scope / outcome / evidence / unresolved. |

Reuse the existing `tia-portal` wing (862 drawers, mostly V21 docs crawls). Create `fork-sync` and
`project-server-fix` rooms for sync-specific content so it does not mix with the docs crawls.

## Phase 1 — RETRIEVE (step 0 of the procedure, before any file change)

Load prior context so you do not rediscover known facts. Run these read-only queries:

```text
# 1. Fork identity + relationships (is_fork_of, contains_fix, sync_source)
#    and per-version working state (fix_required_for, working_versions)
mcp_mempalace_mempalace_kg_query(entity="TiaImportExport.VSExt")
mcp_mempalace_mempalace_kg_query(entity="TiaImportExport.VSExt project server fix")

# 2. Prior sync lessons / procedures (durable, verbatim)
mcp_mempalace_mempalace_list_drawers(wing="tia-portal", room="fork-sync")
mcp_mempalace_mempalace_list_drawers(wing="tia-portal", room="project-server-fix")

# 3. Recent diary entries from prior sync sessions
mcp_mempalace_mempalace_diary_read(agent_name="tia-fork-sync", last_n=5)
```

**What to load and act on:**

- The **fix's exact file locations** (the four protected C# files) — confirm they still match before
  relying on them.
- The **current per-version working state** (`working_versions` fact) — tells you which of
  V18/V19/V20/V21 are FIXED vs BASELINE-MATCH vs NOT-INSTALLED before you build, so step 7 is a
  confirmation, not a discovery. Note (2026-06-23): the fix is required by **both V19 and V21**;
  the earlier "V19 works without fix" note was retracted.
- **Prior gotchas**: the `--no-dependencies` VSIX pitfall, the locked-DLL rename-trick, the
  Openness-PublicAPI-missing skip, the `node_modules`-copy-not-`npm-install` rule.
- The **author baseline commit** (`50d1984` = the v3.0.0 import) used for baseline-DLL detection.

If the palace has no `tia-fork-sync` content yet (first run), skip retrieval and ensure you CAPTURE
at the end so the next run benefits.

## Phase 2 — CAPTURE (step 12 of the procedure, after install + smoke-test)

Capture only what is **durable** (matters in 30 days), **not duplicated**, and **not speculative**.
Follow the mempalace-capture storage rules.

### 2a. Diary entry — ALWAYS (session compression)

One compressed AAAK entry per sync. Four parts: scope / durable outcome / evidence / unresolved edge.

```text
mcp_mempalace_mempalace_diary_write(
  agent_name="tia-fork-sync",
  entry="scope:sync-fork-<ver>|outcome:<js-merged+vsix-built+overlay-installed>|evidence:<method-parity-N/N+working-versions-list>|unresolved:<v18/v20-not-installed or none>",
  topic="fork-sync")
```

Example (2026-06-23, after the V19-correction + Quick Fix Deploy of the fix into 3.0.57):
```
scope:fix-deploy-3.0.57|outcome:v19+v21-fixed-dlls-swapped+co-located-deps+rename-trick|evidence:v21-fixed-DLL-41A93052+v19-targeted-build-95B8C4AA+project-server-connect-works|unresolved:v18/v20-not-installed+software-unit-tools-unimplemented(6-method-parity-gap)
```

### 2b. Knowledge graph facts — ONLY if a stable fact changed

Atomic facts (subject → predicate → object). Add temporal bounds when they matter. Invalidate the
old fact before adding the new one if a fact changed (e.g. the working-versions set changed).

```text
# Stable identity (add once, on first capture)
mcp_mempalace_mempalace_kg_add(subject="TiaImportExport.VSExt", predicate="is_fork_of",
  object="mariuszczyrnek.tia-import")
mcp_mempalace_mempalace_kg_add(subject="TiaImportExport.VSExt", predicate="contains_fix",
  object="TIA Portal Project Server multiuser connect")
mcp_mempalace_mempalace_kg_add(subject="TiaImportExport.VSExt", predicate="sync_source",
  object="installed VSIX (author publishes no source)")
# fix_location is split into one fix_in_file fact per C# file (object must be <=128 chars).

# Per-version working state — invalidate + re-add when it changes.
# IMPORTANT (corrected 2026-06-23): the fix is required by BOTH V19 and V21. The earlier
# "V19 works WITHOUT the fix" note (2026-06-19) was a misread — V19 baseline returns
# "No projects found" against a Project Server. Use a single `working_versions` fact.
mcp_mempalace_mempalace_kg_add(subject="TiaImportExport.VSExt project server fix",
  predicate="working_versions",
  object="V21 + V19 both fix required+present (user-verified 2026-06-23); V18/V20 not installed",
  valid_from="2026-06-23")
# If the set later changes (e.g. V20 gets installed + Openness + rebuilt + verified):
# mcp_mempalace_mempalace_kg_invalidate(subject="TiaImportExport.VSExt project server fix",
#   predicate="working_versions", object="<previous object>", ended="<date>")
# mcp_mempalace_mempalace_kg_add(subject="TiaImportExport.VSExt project server fix",
#   predicate="working_versions", object="V19 V20 V21 working; V18 not installed", valid_from="<date>")
```

### 2c. Drawer — ONLY for a NEW durable procedure (after a duplicate check)

A verbatim procedure worth recovering verbatim later. **Always duplicate-check first.**

```text
mcp_mempalace_mempalace_check_duplicate(content="<the full procedure text>")
# If is_duplicate=false:
mcp_mempalace_mempalace_add_drawer(
  wing="tia-portal", room="fork-sync",
  content="<verbatim procedure: commands, order, why>",
  source_file="<path to script or doc>", added_by="tia-fork-sync")
```

Candidates for drawers (only file the ones that are NEW):

- The overlay-install procedure (rename-trick for locked DLLs) — file once, reference from the skill.
- The VSIX-build procedure (neutralize `vscode:prepublish`, no `--no-dependencies`, stage
  `node_modules` from installed ext).
- The all-versions fix verification procedure.

### What NOT to capture

- Raw command output, intermediate diffs, or the merged JS contents (those are in git).
- Secrets, tokens, connection strings.
- Speculation about why the author changed something.
- Anything already in a drawer (run `check_duplicate` first).

## Completion check (before ending the session)

- [ ] Diary entry written (always).
- [ ] Knowledge-graph facts added/updated **only if** the all-versions fix state or fork identity
      changed.
- [ ] Any new durable procedure filed as a drawer **only after** a duplicate check.
- [ ] No secrets, no ephemeral chatter, no duplicates filed.
