# TIA CLI Bridge Instructions

The TIA Import extension exposes a localhost-only JSON bridge for external scripts and agents.

## State File

When VS Code activates the extension and `tiaImport.cli.enabled` is true, the extension writes:

```json
{
  "version": 1,
  "host": "127.0.0.1",
  "port": 58469,
  "token": "..."
}
```

Default location: `.tia/cli.json` in the workspace.

Rules:

- Read `.tia/cli.json` at runtime before every automation session.
- Do not hard-code the port or token.
- Do not commit `.tia/cli.json`.
- Re-read the state file after VS Code reloads.

## Request Shape

Send authenticated requests to `POST /api`:

```json
{
  "command": "list_devices",
  "args": {}
}
```

Use `Authorization: Bearer <token>` from `.tia/cli.json`.

`GET /health` returns available commands and does not require a token.

## Helper

From the extension repository:

```powershell
npm run tia:cli -- current_project --pretty
npm run tia:cli -- get_logs --limit 100 --pretty
npm run tia:cli -- list_devices --pretty
npm run tia:cli -- open_project --filePath "C:\Projects\Demo.ap21" --pretty
```

From another script, either call the HTTP bridge directly or use the same protocol.

## Commands

Command names mirror the Language Model tools and accept both plain names and `tia_` names:

| Command | Purpose |
| --- | --- |
| `prepare_workspace` | Copy workspace templates and helper files. |
| `connect` | Attach to a running TIA Portal instance or use the extension's normal connection flow. |
| `open_project` | Open a TIA project by `filePath` without showing a project picker. |
| `disconnect` / `close_project` | Disconnect from TIA Portal. |
| `current_project` | Return connection and active project metadata. |
| `list_projects` | List open TIA Portal projects. |
| `select_project` | Select the active project by `projectName`. |
| `refresh` | Refresh the project tree/model. |
| `list_devices` | List devices/controllers. |
| `list_blocks` | List blocks for a selected device. Supports `nameFilter`, `offset`, `limit`. |
| `import_blocks` | Pull selected blocks, or all blocks when `blocks` is omitted. Uses the extension's configured block formats (`tiaImport.exportFormat`, `tiaImport.dbExportFormat`, SD preview mirror). |
| `export_block` | Pull one block from TIA Portal to local files. |
| `export_device` | Pull all program objects for one device. |
| `export_hw_config` | Pull hardware configuration. Omit `device` for all devices. |
| `export_project` | Pull all devices and optionally HW config. |
| `import_file` | Push one local XML/SCL/s7dcl/xlsx file to TIA Portal. |
| `import_folder` | Push all supported files from a folder. |
| `import_hw_config` | Push HW config `.xml`/`.aml` file or folder. |
| `compile` | Compile PLC software for a device. |
| `get_problems` | Return current diagnostics. |
| `fix_compile_errors` | One import/compile/diagnostics iteration. |
| `export_cross_references` | Export cross-reference data for a PLC. |
| `get_logs` | Return recent extension log entries. |

## Recommended Agent Workflow

1. Call `current_project`.
2. If not connected, call `connect`, then `list_projects` and `select_project` when needed.
3. Call `refresh`, `list_devices`, and `list_blocks` before choosing block IDs or device names.
4. Prefer narrow import/export scopes. For block pulls, use `import_blocks` with `blocks` or `export_block`; both honor the extension's configured file formats.
5. After every import, call `compile` and inspect `get_problems`.
6. Use `get_logs` when TIA Portal or the wrapper reports ambiguous failures.

## Safety

- The bridge binds only to `127.0.0.1`.
- Every `POST /api` request requires the per-session token.
- Write operations modify the active TIA Portal project; keep scopes explicit.
- Validate imported/exported PLC changes in TIA Portal before downloading to hardware.
