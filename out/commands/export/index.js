"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectPlcFolders = exports.detectPlcFolderType = exports.exportXlsxFolderToTiaCommand = exports.exportXlsxToTiaCommand = exports.exportProgramToTiaCommand = exports.exportUnifiedToTiaCommand = exports.exportBlockFolderToTiaCommand = exports.exportXmlFolderToTiaCommand = exports.exportBlockToTiaCommand = exports.exportXmlToTiaCommand = exports.pickOverwriteMode = exports.pickDevice = exports.validateProjectDevices = exports.ensureConnection = exports.findProgramBlocksBasePath = exports.detectFolderType = exports.getEmptyFoldersInDirectory = exports.getSupportedFilesInFolder = exports.sortXmlFilesForImport = exports.isKnowHowProtectedPlaceholder = exports.isDependencyError = exports.isAlreadyExistsError = exports.SUPPORTED_EXTENSIONS = void 0;
// Export utilities
var exportUtils_1 = require("./exportUtils");
Object.defineProperty(exports, "SUPPORTED_EXTENSIONS", { enumerable: true, get: function () { return exportUtils_1.SUPPORTED_EXTENSIONS; } });
Object.defineProperty(exports, "isAlreadyExistsError", { enumerable: true, get: function () { return exportUtils_1.isAlreadyExistsError; } });
Object.defineProperty(exports, "isDependencyError", { enumerable: true, get: function () { return exportUtils_1.isDependencyError; } });
Object.defineProperty(exports, "isKnowHowProtectedPlaceholder", { enumerable: true, get: function () { return exportUtils_1.isKnowHowProtectedPlaceholder; } });
Object.defineProperty(exports, "sortXmlFilesForImport", { enumerable: true, get: function () { return exportUtils_1.sortXmlFilesForImport; } });
Object.defineProperty(exports, "getSupportedFilesInFolder", { enumerable: true, get: function () { return exportUtils_1.getSupportedFilesInFolder; } });
Object.defineProperty(exports, "getEmptyFoldersInDirectory", { enumerable: true, get: function () { return exportUtils_1.getEmptyFoldersInDirectory; } });
Object.defineProperty(exports, "detectFolderType", { enumerable: true, get: function () { return exportUtils_1.detectFolderType; } });
Object.defineProperty(exports, "findProgramBlocksBasePath", { enumerable: true, get: function () { return exportUtils_1.findProgramBlocksBasePath; } });
// Export dialogs
var exportDialogs_1 = require("./exportDialogs");
Object.defineProperty(exports, "ensureConnection", { enumerable: true, get: function () { return exportDialogs_1.ensureConnection; } });
Object.defineProperty(exports, "validateProjectDevices", { enumerable: true, get: function () { return exportDialogs_1.validateProjectDevices; } });
Object.defineProperty(exports, "pickDevice", { enumerable: true, get: function () { return exportDialogs_1.pickDevice; } });
Object.defineProperty(exports, "pickOverwriteMode", { enumerable: true, get: function () { return exportDialogs_1.pickOverwriteMode; } });
// Export commands - single file
var exportSingleFile_1 = require("./exportSingleFile");
Object.defineProperty(exports, "exportXmlToTiaCommand", { enumerable: true, get: function () { return exportSingleFile_1.exportXmlToTiaCommand; } });
Object.defineProperty(exports, "exportBlockToTiaCommand", { enumerable: true, get: function () { return exportSingleFile_1.exportBlockToTiaCommand; } });
// Export commands - folder
var exportFolder_1 = require("./exportFolder");
Object.defineProperty(exports, "exportXmlFolderToTiaCommand", { enumerable: true, get: function () { return exportFolder_1.exportXmlFolderToTiaCommand; } });
Object.defineProperty(exports, "exportBlockFolderToTiaCommand", { enumerable: true, get: function () { return exportFolder_1.exportBlockFolderToTiaCommand; } });
// Export commands - unified (multi-folder PLC export)
var exportUnified_1 = require("./exportUnified");
Object.defineProperty(exports, "exportUnifiedToTiaCommand", { enumerable: true, get: function () { return exportUnified_1.exportUnifiedToTiaCommand; } });
Object.defineProperty(exports, "exportProgramToTiaCommand", { enumerable: true, get: function () { return exportUnified_1.exportProgramToTiaCommand; } });
// Export commands - XLSX tag tables
var exportXlsxToTia_1 = require("./exportXlsxToTia");
Object.defineProperty(exports, "exportXlsxToTiaCommand", { enumerable: true, get: function () { return exportXlsxToTia_1.exportXlsxToTiaCommand; } });
Object.defineProperty(exports, "exportXlsxFolderToTiaCommand", { enumerable: true, get: function () { return exportXlsxToTia_1.exportXlsxFolderToTiaCommand; } });
var exportUnifiedHelpers_1 = require("./exportUnifiedHelpers");
Object.defineProperty(exports, "detectPlcFolderType", { enumerable: true, get: function () { return exportUnifiedHelpers_1.detectPlcFolderType; } });
Object.defineProperty(exports, "detectPlcFolders", { enumerable: true, get: function () { return exportUnifiedHelpers_1.detectPlcFolders; } });
//# sourceMappingURL=index.js.map