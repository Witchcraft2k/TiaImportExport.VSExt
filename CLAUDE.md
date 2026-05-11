# Claude Code Instructions

This workspace is a TIA Portal project mirror managed by the
**TIA Portal Import** VS Code extension. The full ruleset (TIA Portal
Openness API reference, file conventions for `.xml` / `.s7dcl` / `.s7res`,
SimaticML structure, the 17 `tia_*` Language Model Tools, build commands
and the autonomous compile-fix loop) lives in a single source of truth
that is shared with GitHub Copilot.

@.github/copilot-instructions.md

## Quick reminders for Claude Code

- **Always start with `tia_connect`.** If `currentProjectName` is empty,
  call `tia_list_projects` then `tia_select_project` before anything else.
- **Resolve block ids via `tia_list_blocks`** — never guess ids.
- **After every import, run `tia_compile`** and inspect
  `tia_get_problems` (or the `messages` returned by `tia_compile`).
- **Use `tia_fix_compile_errors` to autonomously iterate** import →
  compile → diagnostics. Stop when `compile.success === true` or
  `iterationsRemaining === 0`.
- **HW Config push uses `tia_import_hw_config`**, not `tia_import_file`.
- **Imports that overwrite existing TIA objects trigger a confirmation
  dialog** unless `tiaImport.lmTools.autoConfirmImports` is enabled — do
  not try to bypass it.
- `.s7dcl` blocks are **LAD/FBD-only** — don't try to hand-edit them as
  SCL.

## Local overrides

If you need machine-local notes that should not be committed, create
`CLAUDE.local.md` next to this file — it is already covered by
`.gitignore`.
