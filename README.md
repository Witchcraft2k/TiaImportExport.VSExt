# TIA Portal Import — VS Code Extension

<!-- VERSION-BADGE -->
[![Version](https://img.shields.io/badge/version-1.0.120-blue)](package.json)
<!-- /VERSION-BADGE -->

[![VS Code](https://img.shields.io/badge/VS%20Code-%3E%3D1.80.0-blue?logo=visualstudiocode)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows)](https://www.microsoft.com/windows)
[![Author](https://img.shields.io/badge/Author-Mariusz%20Czyrnek-orange?logo=linkedin)](https://www.linkedin.com/in/mariusz-czyrnek-a33b87a6)

**Bidirectional bridge between VS Code and Siemens TIA Portal** — import PLC/HMI projects from TIA Portal to local files, edit them with full VS Code + Copilot power, and export changes back. Built on the TIA Portal Openness API.

---

## Key Features

### Import from TIA Portal (TIA → local files)

| Capability                      | Description                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Connect to TIA Portal** | Auto-detect running TIA Portal instances or open a project file (`.ap21`)                                       |
| **Import Entire Project** | Export complete project structure with all devices, blocks, tags, UDTs, and HW config                             |
| **Import Devices**        | Import individual devices or all devices in a category (PLCs, HMIs, IO_Devices, Computers)                        |
| **Import Program Blocks** | Export OB, FB, FC, F-FB, F-FC, DB blocks in XML, SCL, SD (`.s7dcl` / `.s7res`), or DB source (`.db`) format |
| **Import Tag Tables**     | Export PLC tag tables as SimaticML XML or Excel XLSX spreadsheets                                                 |
| **Import UDTs**           | Export PLC data types (user-defined types)                                                                        |
| **Import Watch Tables**   | Export watch and force tables                                                                                     |
| **Import HMI**            | Export HMI screens, tags, and connections                                                                         |
| **Import HW Config**      | Export hardware configuration for all devices                                                                     |
| **Project Explorer**      | Browse the full TIA Portal project hierarchy in the VS Code sidebar                                               |

### Export to TIA Portal (local files → TIA)

| Capability                           | Description                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Export Blocks**              | Import XML / SCL / SD / DB source files back to TIA Portal                                                     |
| **Export Tag Tables**          | Import XML or XLSX tag tables to TIA Portal                                                                    |
| **Export UDTs / Watch Tables** | Import data types and watch tables                                                                             |
| **Export HW Config**           | Import hardware configuration (XML / AML / CAx)                                                                |
| **Unified Export**             | One-click export of an entire device folder in dependency order (UDTs → Blocks → Tags → Watch Tables → HW) |
| **Smart Comparison**           | Only overwrite items that actually changed (normalized XML diff; Instance DBs compared by StartValues only)    |
| **Orphan Cleanup**             | Auto-delete blocks, groups, tag tables, and UDTs in TIA that no longer exist locally                           |
| **Dependency Ordering**        | Files sorted automatically: UDT → FB → FC → OB → GlobalDB → InstanceDB                                    |
| **Compile after Export**       | Automatically compile PLC software in TIA Portal after export — configurable: Always / Ask / Never            |
| **Compile Error Tracking**     | Compile results mapped to VS Code PROBLEMS panel with file and line resolution (network / SCL line mapping)    |

### Smart Capabilities

- **Connection health monitoring** — automatic ping-based checks with auto-disconnect on broken connections
- **Know-how protected block detection** — detects and skips placeholder files for protected blocks
- **Instance DB creation** — creates Instance DBs directly via API (no XML import needed)
- **Cancellation support** — cancel long-running operations via VS Code progress UI
- **Status bar** — real-time connection state and project info
- **Compile after export** — optional PLC software compilation in TIA Portal after each export (Always / Ask / Never); results shown in OUTPUT panel
- **Compile error tracking** — compile errors and warnings mapped to VS Code PROBLEMS panel with automatic file matching, network-to-line resolution (XML, S7DCL, SCL), and direct navigation to the error location

---

## Requirements

| Requirement          | Version                             |
| -------------------- | ----------------------------------- |
| **OS**         | Windows 10 / 11                     |
| **TIA Portal** | ≥ V21 with Openness license       |
| **.NET**       | .NET 8.0 Runtime                    |
| **VS Code**    | ≥ 1.80.0                           |
| **Node.js**    | 20+ (for building / packaging only) |

> Export-to-TIA features require **TIA Portal V21**.
>
> The Windows user running VS Code must be a member of the **Siemens TIA Openness** user group. See [Adding users to the Siemens TIA Openness user group](https://docs.tia.siemens.cloud/r/en-us/v20/tia-portal-openness-api-for-automation-of-engineering-workflows/basics/installation/adding-users-to-the-siemens-tia-openness-user-group) for details.

---

## Installation

1. Install the extension from VS Code Marketplace (or `code --install-extension mariusz-czyrnek.tia-import`)
2. Make sure TIA Portal is installed with an Openness license
3. Make sure end users of your distributed package also have their own valid TIA Portal + Openness license
4. Optionally adjust settings via **File → Preferences → Settings → TIA Portal Import**

---

## Usage

### Connecting to TIA Portal

1. Start TIA Portal and open a project
2. Open VS Code in a workspace folder
3. Click the **TIA Portal** icon in the Activity Bar
4. Click **Connect to TIA Portal** or run the command `TIA Import: Connect to TIA Portal`
5. The extension auto-detects running instances; if multiple are found, you pick one

### Importing from TIA Portal

1. Connect to TIA Portal
2. Browse the project structure in the **TIA Project Explorer** sidebar
3. Right-click on any node to import:
   - **Device** — import entire device (all blocks, tags, UDTs, watch tables)
   - **Device Category** — import all devices in a category (e.g. all PLCs)
   - **Block Group** — import a folder with all its blocks
   - **Block** — import a single program block
   - **Tag Tables** — import PLC tag tables (XML or XLSX)
   - **UDTs** — import PLC data types
   - **Watch Tables** — import observation/force tables
   - **HMI** — import screens, tags, and/or connections
   - **HW Config** — import hardware configuration
4. Files are saved under `TiaExport/Projects/<ProjectName>/Devices/` in your workspace

### Exporting to TIA Portal

1. Connect to TIA Portal V21
2. In the **VS Code Explorer**, right-click on a file or folder
3. Choose the appropriate export command:
   - **Export Blocks to TIA** — for program blocks (`.xml`, `.scl`, `.s7dcl`, `.db`)
   - **Export XLSX Tags to TIA Portal** — for XLSX tag tables
   - **Export to TIA - Program and HW** — unified export (program + HW config)
   - **Export to TIA - Program without HW** — unified export (program only)
   - **Export to TiaPortal: HW Config XML** — hardware configuration
4. Select overwrite mode: *Compare & overwrite changes* or *Force overwrite all*
5. If **Compile after Export** is enabled (`always` or `ask`), the extension compiles PLC software in TIA Portal after a successful export
6. Compile results are shown in the **OUTPUT** panel; errors and warnings appear in the **PROBLEMS** panel with clickable file links

### Exported Directory Structure

When you connect to TIA Portal (or run the `TIA Import: Prepare Workspace` command), the extension scaffolds the workspace with template files:

```
<Workspace>/
├── .gitignore                        # TIA-specific ignores (from template)
├── .github/
│   ├── copilot-instructions.md       # AI coding rules for TIA XML files
│   ├── ProjectDescription.md         # Auto-generated project description
│   └── Schemas/                      # SimaticML XSD schemas
├── Tools/                            # Utility scripts (Python, PS, etc.)
├── UserFiles/                        # Output dir for scripts (git-ignored)
├── TiaExport/
│   ├── .tia-cache/                   # Temporary cache (git-ignored)
│   └── Projects/
│       └── <ProjectName>/
│           └── Devices/
│               ├── PLCs/
│               │   └── <PLC_Name>/
│               │       ├── DeviceConfiguration/
│               │       │   └── <Device>_HwConfig.xml
│               │       └── <PLC_Software>/
│               │           ├── Program blocks/
│               │           │   ├── Main [OB1].xml
│               │           │   ├── MyFB [FB1].xml
│               │           │   └── SubFolder/
│               │           ├── PLC tags/
│               │           │   └── Default tag table.xlsx
│               │           ├── PLC data types/
│               │           │   └── MyUDT.xml
│               │           └── Watch and force tables/
│               │               └── Watch_1.xml
│               ├── HMIs/
│               │   └── <HMI_Name>/
│               │       └── <HMI_Software>/
│               │           ├── Screens/
│               │           ├── HMI Tags/
│               │           └── Connections/
│               ├── IO_Devices/
│               │   └── <IO_Device>/
│               │       └── DeviceConfiguration/
│               └── Computers/
```

Template files (`.gitignore`, `.github/`) are only created if they don't already exist — existing files are never overwritten. Templates are maintained in `Documentation/Templates/`.

You can also scaffold the workspace manually at any time via `TIA Import: Prepare Workspace` command (available in the Command Palette and in the Connection panel title bar).

### Workspace Templates (`.github/`)

On first connection to TIA Portal (or when you run `TIA Import: Prepare Workspace`), the extension copies template files from `Documentation/Templates/` into your workspace root. The `.github/` directory contains resources that enhance both AI-assisted development and XML validation:

| File / Folder                                 | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`.github/copilot-instructions.md`** | Instructions for GitHub Copilot (and other AI assistants) that teach the model how to work with Siemens TIA Portal XML files. Covers SimaticML XML structure,`.s7dcl` / `.s7res` file conventions, MLC ID handling, network titles/comments, and rules for updating `ProjectDescription.md`. These instructions are automatically picked up by Copilot in VS Code.                                                         |
| **`.github/ProjectDescription.md`**   | A living document describing the project's architecture, communication topology, block hierarchy, data structures, and data flow. Initially empty — it is populated automatically by Copilot when you start analyzing the project (as instructed by `copilot-instructions.md`). Should be kept up to date when blocks, communication channels, or data structures change. Includes Mermaid diagrams for visual documentation. |
| **`.github/Schemas/`**                | SimaticML XSD schema files (`SW.PlcBlocks.*.xsd`, `SW.Common_v3.xsd`, etc.) copied from `Documentation/Schemas/`. These schemas enable XML validation and IntelliSense for exported TIA Portal block files directly in VS Code.                                                                                                                                                                                            |
| **`.gitignore`**                      | TIA-specific ignore rules (e.g.`.tia-cache`) to keep temporary/cache files out of version control.                                                                                                                                                                                                                                                                                                                             |

> **Tip:** Commit the `.github/` directory to your Git repository so that every team member and CI pipeline benefits from the same AI instructions, project documentation, and XML schemas.

---

## Extension Settings

| Setting                               | Description                                                          | Default              |
| ------------------------------------- | -------------------------------------------------------------------- | -------------------- |
| `tiaImport.exportFolderName`        | Folder name for TIA exports                                          | `TiaExport`        |
| `tiaImport.tiaPortalPath`           | Path to TIA Portal installation                                      | `C:\…\Portal V21` |
| `tiaImport.autoConnect`             | Auto-connect on activation                                           | `false`            |
| `tiaImport.includeComments`         | Include comments in export                                           | `true`             |
| `tiaImport.exportFormat`            | Block export format (`xml` / `sd`)                               | `xml`              |
| `tiaImport.tagTableFormat`          | Tag table export format (`xml` / `xlsx`)                         | `xlsx`             |
| `tiaImport.preserveTimestamps`      | Preserve original timestamps                                         | `true`             |
| `tiaImport.excludeSystemBlocks`     | Exclude system blocks                                                | `true`             |
| `tiaImport.dotnetPath`              | Path to .NET runtime                                                 | Auto-detect          |
| `tiaImport.dbExportFormat`          | Global DB export format (`xml` / `db`)                           | `db`               |
| `tiaImport.showImportExportDetails` | Show detailed import/export messages in the output log               | `false`            |
| `tiaImport.compileAfterExport`      | Compile PLC software after export (`always` / `ask` / `never`) | `ask`              |

### Block Export Formats

| Format        | Extension                          | Description                                                                                                                                                                                                              |
| ------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **xml** | `.xml`                           | SimaticML XML — full block data with interface sections, networks, and metadata. Default TIA Portal format.                                                                                                             |
| **sd**  | `.scl` / `.s7dcl` + `.s7res` | SIMATIC Source Documents — auto-selects per programming language: SCL blocks →`.scl` (via `GenerateSource`), LAD/FBD/STL blocks → `.s7dcl` + `.s7res` (via `ExportAsDocuments`). Ideal for version control. |

### Global DB Export Formats

Controlled by `tiaImport.dbExportFormat` (applies only to Global Data Blocks; Instance DBs always use XML):

| Format        | Extension | Description                                                                                                          |
| ------------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| **xml** | `.xml`  | SimaticML XML — standard TIA Portal format                                                                          |
| **db**  | `.db`   | Text-based `DATA_BLOCK` source via `GenerateSource` API — compact, diff-friendly, importable back to TIA Portal |

### Tag Table Export Formats

| Format         | Extension | Description                                                                                                                   |
| -------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **xml**  | `.xml`  | SimaticML XML — native TIA Portal format                                                                                     |
| **xlsx** | `.xlsx` | Excel spreadsheet — sheets "Tags" and "Constants", with Siemens-style formatting. Editable in Excel, importable back to TIA. |

---

## Commands

### Import Commands (TIA → local)

| Command                                                     | Description                                       |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `TIA Import: Connect to TIA Portal`                       | Connect / attach to a running TIA Portal instance |
| `TIA Import: Disconnect from TIA Portal`                  | Disconnect from TIA Portal                        |
| `TIA Import: Select Project`                              | Select a project from the connected TIA Portal    |
| `TIA Import: Import Entire Project`                       | Import full project structure                     |
| `TIA Import: Refresh Project Structure`                   | Refresh the project tree                          |
| `TIA Import: Import Device`                               | Import a device with all software                 |
| `TIA Import: Import Block`                                | Import a single block                             |
| `TIA Import: Import Block Folder`                         | Import a block group/folder                       |
| `TIA Import: Import Tag Tables`                           | Import all tag tables                             |
| `TIA Import: Import Tag Table`                            | Import a single tag table                         |
| `TIA Import: Import Data Types`                           | Import all UDTs                                   |
| `TIA Import: Import Data Type`                            | Import a single UDT                               |
| `TIA Import: Import Watch Tables`                         | Import all watch tables                           |
| `TIA Import: Import Watch Table`                          | Import a single watch table                       |
| `TIA Import: Import HMI Screens`                          | Import HMI screens                                |
| `TIA Import: Import HMI Tags`                             | Import HMI tags                                   |
| `TIA Import: Import HMI Connections`                      | Import HMI connections                            |
| `TIA Import: Import All HMI Elements`                     | Import all HMI elements                           |
| `TIA Import: Import HW Configuration`                     | Import full HW configuration                      |
| `TIA Import: Import Device HW Configuration`              | Import HW config for a single device              |
| `TIA Import: Import Programs for All Devices in Category` | Import all devices in a category                  |

### Export Commands (local → TIA)

| Command                                     | Description                                        |
| ------------------------------------------- | -------------------------------------------------- |
| `Export Blocks to TIA`                    | Export a block file (XML / SCL / SD) to TIA Portal |
| `Export Blocks to TIA (Folder)`           | Export all blocks in a folder                      |
| `Export to TiaPortal: XML File`           | Export a single XML file (non-block)               |
| `Export to TiaPortal: XML Folder`         | Export an XML folder                               |
| `Export XLSX Tags to TIA Portal`          | Export XLSX tag table to TIA Portal                |
| `Export XLSX Tags to TIA Portal (Folder)` | Export all XLSX tag tables in a folder             |
| `Export to TiaPortal: HW Config XML`      | Export HW config (XML/AML)                         |
| `Export to TiaPortal: HW Config Folder`   | Export HW config folder                            |
| `Export to TIA - Program and HW`          | Unified export (program + HW config)               |
| `Export to TIA - Program without HW`      | Unified export (program only, no HW)               |

### Utility Commands

| Command                              | Description                                       |
| ------------------------------------ | ------------------------------------------------- |
| `TIA Import: Show Logs`            | Open the extension output channel                 |
| `TIA Import: Open Settings`        | Open extension settings page                      |
| `TIA Import: Select Export Format` | Switch block export format                        |
| `TIA Import: Format PLC Tags`      | Toggle tag table format (XML/XLSX)                |
| `TIA Import: Prepare Workspace`    | Scaffold workspace (`.github/`, `TiaExport/`) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       VS Code Extension                     │
│                                                             │
│  ┌────────────┐  ┌─────────────┐  ┌───────────────────────┐│
│  │  Commands   │  │  Providers  │  │       Utilities       ││
│  │ (import/    │  │ (tree view, │  │ (logger, config,      ││
│  │  export)    │  │  connection)│  │  statusBar, workspace)││
│  └──────┬─────┘  └──────┬──────┘  └───────────────────────┘│
│         │               │                                   │
│  ┌──────▼───────────────▼──────────────────────────────────┐│
│  │              Services Layer                             ││
│  │  tiaConnection · projectImport · tiaOpennessBridge      ││
│  │  blockImport · tagTableImport · udtImport               ││
│  │  watchTableImport · hmiImport                           ││
│  └──────────────────────┬──────────────────────────────────┘│
│                         │  electron-edge-js                 │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                  .NET Wrapper (C#)                           │
│                                                             │
│  TiaConnector.cs ─► TiaPortalService.cs                     │
│                         │                                   │
│  ┌──────────────────────┼──────────────────────────────┐    │
│  │  Services/Export/                                   │    │
│  │   Software: BlockExportHandler, TagTableExport,     │    │
│  │     UdtExport, WatchTableExport, SdExportHandler,   │    │
│  │     SclExportHandler, XmlComparisonService           │    │
│  │   HW: HwConfigExportToTia, DeviceExportHelper       │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │  Services/Import/                                   │    │
│  │   Software: BlockImport, TagTableImport, UdtImport, │    │
│  │     WatchTableImport, HmiImport, TagTableXlsx       │    │
│  │   HW: HwConfigImport, DeviceItemHelper              │    │
│  └──────────────────────────────────────────────────────┘    │
│                         │                                   │
│              Siemens.Engineering.dll (TIA Openness API)      │
└─────────────────────────────────────────────────────────────┘
```

The extension uses **electron-edge-js** to call the .NET `TiaOpennessWrapper.dll` in-process from Node.js. The wrapper communicates with TIA Portal via the official **Siemens TIA Portal Openness API** (`Siemens.Engineering` assemblies).

---

## Documentation

- [TIA Portal Openness API (Siemens)](https://docs.tia.siemens.cloud/r/en-us/v21/tia-portal-openness-api-for-automation-of-engineering-workflows) — official Openness API documentation
- [Documentation/API/](Documentation/API/) — XML intellisense files for the Openness API
- [Documentation/Schemas/](Documentation/Schemas/) — SimaticML XSD schemas for all block types
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) — third-party components and redistribution notes

---

## Third-Party Licensing & Redistribution

- This extension code is released under [MIT](LICENSE).
- Third-party notices for npm/NuGet components are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- For Siemens Openness components, use and distribution are subject to Siemens package terms; evaluate those terms for your release scenario.
- Do **not** bundle or redistribute `Siemens.Engineering.*` binaries with this extension unless explicitly allowed by Siemens terms.
- End users must provide their own licensed TIA Portal installation and Openness entitlement.

---

## Known Issues & Limitations

- **Windows only** — TIA Portal and the Openness API are Windows-only
- **Know-how protected blocks** — cannot be exported; the extension detects and skips placeholder files
- **Export requires TIA Portal ≥ V21** — import from TIA works with V18+, but export-to-TIA needs ≥ V21
- **SD format (LAD/FBD)** — only supports LAD/FBD and mixed blocks (no protected blocks)
- **Large projects** — full project import may take several minutes depending on project size

---

## Disclaimer of Liability

The extension is a development and automation tool, and all imports/exports modify engineering data at your own risk.

The author is not liable for any direct or indirect damages, production downtime, data loss, project corruption, safety incidents, or other consequences resulting from changes made to TIA Portal projects using this extension.

Users are fully responsible for validating, testing, and approving all generated or imported changes before deployment to real machines, production lines, or safety-related systems.

---

## Development

### Debugging (F5)

Use **Run and Debug** (F5) to start an Extension Development Host:

| Launch Config                              | Description                                                     |
| ------------------------------------------ | --------------------------------------------------------------- |
| **Run Extension**                    | Builds TypeScript + .NET wrapper, then launches                 |
| **Run Extension (watch)**            | Starts `tsc -watch` + builds .NET wrapper once, then launches |
| **Run Extension (watch, no dotnet)** | `tsc -watch` only — fastest when C# hasn't changed           |

### Building from Source

```bash
# Install dependencies
npm install

# Build TypeScript
npm run compile

# Build .NET wrapper
npm run build:dotnet

# Build everything
# (use VS Code task "Build All")

# Watch mode (TypeScript only)
npm run watch

# Run linter
npm run lint

# Run tests (includes TS↔.NET method parity check)
npm test

# Run only method parity check
npm run test:method-parity

# Package extension (.vsix)
npm run package
```

You can also run parity check from VS Code task: **Test: method parity**.

> If `npm run package` fails on Node.js 18 with `ReferenceError: File is not defined` (from `undici`), switch to **Node.js 20+**.

### Project Structure

```
TiaAI.ExtVScode/
├── src/                           # TypeScript source (VS Code extension)
│   ├── extension.ts               #   Entry point — activation, service init
│   ├── commands/                   #   VS Code command handlers
│   │   ├── connectCommand.ts      #     Connect/disconnect to TIA Portal
│   │   ├── import*.ts             #     Import commands (blocks, tags, UDTs, HMI…)
│   │   └── export/                #     Export-to-TIA commands
│   │       ├── exportUnified.ts   #       Unified device export (dependency order)
│   │       ├── exportSingleFile.ts#       Single file export
│   │       ├── exportFolder.ts    #       Folder batch export
│   │       └── exportUtils.ts     #       Sorting, detection, utilities
│   ├── providers/                 #   VS Code tree view data providers
│   │   ├── projectTreeProvider.ts #     Project Explorer sidebar tree
│   │   └── connectionTreeProvider.ts #  Connection status panel
│   ├── services/                  #   Business logic layer
│   │   ├── tiaConnection.ts       #     Connection lifecycle & health checks
│   │   ├── tiaOpennessBridge.ts   #     TypeScript ↔ .NET interop (edge-js)
│   │   ├── projectImport.ts       #     Import orchestrator
│   │   └── import/                #     Specialized import services
│   │       ├── blockImportService.ts
│   │       ├── tagTableImportService.ts
│   │       ├── udtImportService.ts
│   │       ├── watchTableImportService.ts
│   │       └── hmiImportService.ts
│   ├── models/                    #   TypeScript data models
│   │   ├── tiaModels.ts           #     Project/device/block models
│   │   └── hwConfigModels.ts      #     Hardware configuration models
│   └── utils/                     #   Shared utilities
│       ├── logger.ts              #     Output channel logger
│       ├── config.ts              #     Extension settings helper
│       ├── statusBar.ts           #     Status bar connection indicator
│       └── workspace.ts           #     Workspace/template management
├── dotnet/                        # .NET wrapper (C# — TIA Openness API)
│   └── TiaOpennessWrapper/
│       ├── TiaConnector.cs        #   Edge-js entry point & method dispatcher
│       ├── TiaPortalService.cs    #   Core service — connection, project, delegation
│       ├── Models/                #   C# data models
│       │   ├── TiaModels.cs
│       │   └── HwConfigModels.cs
│       └── Services/
│           ├── Export/            #   Export TO TIA Portal (local → TIA)
│           │   ├── Software/      #     Blocks, tags, UDTs, watch tables
│           │   └── HW/            #     Hardware configuration
│           └── Import/            #   Import FROM TIA Portal (TIA → local)
│               ├── Software/      #     Blocks, tags, UDTs, watch tables, HMI
│               └── HW/            #     Hardware configuration
├── Documentation/
│   ├── API/                       # Openness API XML reference files
│   ├── Schemas/                   # SimaticML XSD schemas
│   └── Templates/                 # Workspace template files
│       ├── .gitignore
│       ├── .github/
│       │   ├── copilot-instructions.md
│       │   ├── ProjectDescription.md
│       │   └── Schemas/
│       ├── Tools/                 # Utility scripts (Python, PS, etc.)
│       └── UserFiles/             # Output dir for scripts (git-ignored)
├── resources/icons/               # Extension and tree view icons
├── package.json                   # Extension manifest & contribution points
└── tsconfig.json                  # TypeScript configuration
```

## Community — Share Your Scripts & Ideas

This extension ships with a `Tools/` directory for utility scripts and a `copilot-instructions.md` file that teaches AI assistants how to work with TIA Portal projects.

**We encourage you to contribute!** If you have created useful scripts, automation tools, or improvements to the Copilot instructions:

1. **Fork** the [TiaAI.ExtVScode](https://github.com/cmariusz/TiaAI.ExtVScode) repository on GitHub
2. Add your scripts to `Tools/` (with a matching `.md` description)
3. Or propose changes to `.github/copilot-instructions.md`
4. **Open a Pull Request** — your contribution will help the entire TIA Portal + VS Code community

Every shared script or instruction improves the experience for all users. Don't hesitate to share even small utilities — they often save the most time!

---

## License

[MIT](LICENSE) — Copyright (c) 2026 Mariusz Czyrnek
