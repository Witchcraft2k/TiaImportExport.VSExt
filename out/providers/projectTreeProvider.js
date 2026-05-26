"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TiaProjectTreeProvider = exports.TiaTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const projectImport_1 = require("../services/projectImport");
const TiaTreeItem_1 = require("./tree/TiaTreeItem");
const treeHelpers_1 = require("./tree/treeHelpers");
var TiaTreeItem_2 = require("./tree/TiaTreeItem");
Object.defineProperty(exports, "TiaTreeItem", { enumerable: true, get: function () { return TiaTreeItem_2.TiaTreeItem; } });
/**
 * Tree data provider for TIA Portal project structure
 */
class TiaProjectTreeProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    _connectionService;
    constructor(connectionService) {
        this._connectionService = connectionService;
        // Listen for project changes
        connectionService.onProjectChanged(() => {
            this.refresh();
        });
    }
    /**
     * Refresh the tree view
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get tree item for display
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children of a tree item
     */
    async getChildren(element) {
        if (!this._connectionService.isConnected) {
            return [];
        }
        const project = this._connectionService.currentProject;
        if (!project) {
            return [];
        }
        // Root level - show device categories (PLCs, HMIs, IO_Devices)
        if (!element) {
            return this.getDeviceCategoryItems(project);
        }
        // Handle different element types
        switch (element.contextValue) {
            case 'deviceCategory':
            case 'deviceCategoryHwOnly':
                return this.getDevicesInCategory(element.id, project);
            case 'device':
            case 'deviceWithPlc':
                return this.getDeviceSoftwareItems(element.id, project);
            case 'deviceHwOnly':
                return []; // No children for HW-only devices
            case 'plcSoftware':
                return this.getPlcContentsItems(element.id, element.parentId, project);
            case 'hmiSoftware':
                return this.getHmiContentsItems(element.id, element.parentId, project);
            case 'hmiScreensFolder':
                return this.getHmiScreensFolderItems(element.id, project, element.metadata);
            case 'hmiTagsFolder':
                return this.getHmiTagsFolderItems(element.id, project, element.metadata);
            case 'hmiScreenGroup':
                return this.getHmiScreenGroupItems(element.id, element.parentId, project, element.metadata);
            case 'hmiTagGroup':
                return this.getHmiTagGroupItems(element.id, element.parentId, project, element.metadata);
            case 'hmiConnectionsFolder':
                return this.getHmiConnectionItems(element.metadata);
            case 'blockGroup':
                return this.getBlockGroupItems(element.id, element.parentId, project, element.metadata?.groupPath || '', element.metadata);
            case 'tagTableGroup':
                return this.getTagTableGroupItems(element.id, element.parentId, project, element.metadata?.groupPath || '', element.metadata);
            case 'udtGroup':
                return this.getUdtGroupItems(element.id, element.parentId, project, element.metadata?.groupPath || '', element.metadata);
            case 'watchTableGroup':
                return this.getWatchTableGroupItems(element.id, element.parentId, project, element.metadata?.groupPath || '', element.metadata);
            case 'libraryFolder':
                return this.getLibraryFolderItems(element.metadata);
            case 'libraryRoot':
                return this.getLibraryRootChildren(element.metadata);
            case 'libraryTypeFolder':
                return this.getLibraryTypeFolderItems(element.metadata);
            default:
                return [];
        }
    }
    /**
     * Get device category items (PLCs, HMIs, IO_Devices folders)
     */
    getDeviceCategoryItems(project) {
        const categories = [
            { name: 'PLCs', displayName: 'PLCs' },
            { name: 'HMIs', displayName: 'HMIs' },
            { name: 'IO_Devices', displayName: 'IO_Devices' },
            { name: 'Computers', displayName: 'Computers' }
        ];
        const items = [];
        for (const category of categories) {
            // Count devices in this category
            const devicesInCategory = project.devices.filter(d => (0, projectImport_1.getDeviceCategoryFolder)(d.type) === category.name);
            // Only show category if it has devices
            if (devicesInCategory.length > 0) {
                // IO_Devices contains only HW (distributed I/O, drives) - no PLC/HMI software to import.
                // Use a dedicated contextValue so the software-import action is hidden in the tree.
                const categoryContextValue = category.name === 'IO_Devices'
                    ? 'deviceCategoryHwOnly'
                    : 'deviceCategory';
                items.push(new TiaTreeItem_1.TiaTreeItem(category.displayName, category.name, categoryContextValue, vscode.TreeItemCollapsibleState.Collapsed, project.id, { categoryType: category.name, deviceCount: devicesInCategory.length }));
            }
        }
        // Project Library (master copies + types) - read-only branch
        const masterCopiesNode = project.library;
        const libraryTypesNode = project.libraryTypes;
        const hasMasterCopies = !!masterCopiesNode && ((masterCopiesNode.folders && masterCopiesNode.folders.length > 0) ||
            (masterCopiesNode.masterCopies && masterCopiesNode.masterCopies.length > 0));
        const hasLibraryTypes = !!libraryTypesNode && ((libraryTypesNode.folders && libraryTypesNode.folders.length > 0) ||
            (libraryTypesNode.types && libraryTypesNode.types.length > 0));
        if (hasMasterCopies || hasLibraryTypes) {
            items.push(new TiaTreeItem_1.TiaTreeItem('Project library', `${project.id}/Library`, 'libraryRoot', vscode.TreeItemCollapsibleState.Collapsed, project.id, {
                masterCopies: hasMasterCopies ? masterCopiesNode : undefined,
                libraryTypes: hasLibraryTypes ? libraryTypesNode : undefined
            }));
        }
        return items;
    }
    /**
     * Get devices within a specific category
     */
    getDevicesInCategory(category, project) {
        const devicesInCategory = project.devices.filter(d => (0, projectImport_1.getDeviceCategoryFolder)(d.type) === category);
        // Sort devices by display name (same order as TIA Portal explorer)
        const sortedDevices = [...devicesInCategory].sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name, undefined, { sensitivity: 'base' }));
        return sortedDevices.map(device => {
            const hasPlcSoftware = device.plcSoftware && device.plcSoftware.length > 0;
            const hasHmiSoftware = device.hmiSoftware && device.hmiSoftware.length > 0;
            const hasSoftware = hasPlcSoftware || hasHmiSoftware;
            // IO_Devices category contains distributed I/O / drives - hide software import even
            // if the device technically reports software, since users only want HW config there.
            const isIoDevicesCategory = category === 'IO_Devices';
            // Different context for devices with/without software
            const contextValue = (hasSoftware && !isIoDevicesCategory) ? 'deviceWithPlc' : 'deviceHwOnly';
            // Only collapsible if has software to show
            const collapsibleState = (hasSoftware && !isIoDevicesCategory)
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;
            return new TiaTreeItem_1.TiaTreeItem(device.displayName || device.name, device.id, contextValue, collapsibleState, project.id, {
                deviceType: device.type,
                technicalName: device.name,
                hasPlcSoftware,
                hasHmiSoftware,
                category
            });
        });
    }
    /**
     * Get software items (PLC and HMI) for a device
     */
    getDeviceSoftwareItems(deviceId, project) {
        const device = project.devices.find(d => d.id === deviceId);
        if (!device) {
            return [];
        }
        // Avoid duplicate labels in tree: Device -> same-name PLC software -> PLC folders.
        // If this is a single PLC-only device and labels match, skip the intermediate PLC node.
        const hasSinglePlcOnly = device.plcSoftware.length === 1 && device.hmiSoftware.length === 0;
        if (hasSinglePlcOnly) {
            const plc = device.plcSoftware[0];
            const deviceLabel = (device.displayName || device.name).trim();
            const plcLabel = plc.name.trim();
            if (deviceLabel.localeCompare(plcLabel, undefined, { sensitivity: 'base' }) === 0) {
                return this.getPlcContentsItems(plc.id, device.id, project);
            }
        }
        const items = [];
        // Add PLC software
        for (const plc of device.plcSoftware) {
            items.push(new TiaTreeItem_1.TiaTreeItem(plc.name, plc.id, 'plcSoftware', vscode.TreeItemCollapsibleState.Collapsed, device.id));
        }
        // Add HMI software
        for (const hmi of device.hmiSoftware) {
            items.push(new TiaTreeItem_1.TiaTreeItem(hmi.name, hmi.id, 'hmiSoftware', vscode.TreeItemCollapsibleState.Collapsed, device.id, { hmiType: hmi.type }));
        }
        return items;
    }
    /**
     * Get PLC content folders (blocks, tags, UDTs, etc.)
     */
    getPlcContentsItems(plcId, deviceId, project) {
        const device = project.devices.find(d => d.id === deviceId);
        const plc = device?.plcSoftware.find(p => p.id === plcId);
        if (!plc) {
            return [];
        }
        const items = [];
        // Add block groups - use group.id directly as it now contains the full unique path
        for (const group of plc.blockGroups) {
            items.push(new TiaTreeItem_1.TiaTreeItem(group.name, group.id, 'blockGroup', vscode.TreeItemCollapsibleState.Collapsed, plcId, // Just use plcId as parentId, it already contains the device path
            { groupName: group.name, groupPath: '', plcId: plcId }));
        }
        // Add Tag Table groups from hierarchical structure
        if (plc.tagTableGroups && plc.tagTableGroups.length > 0) {
            for (const group of plc.tagTableGroups) {
                items.push(new TiaTreeItem_1.TiaTreeItem(group.name, group.id, // Use group.id directly (now contains full path)
                'tagTableGroup', vscode.TreeItemCollapsibleState.Collapsed, plcId, { groupName: group.name, groupData: group, groupPath: '', plcId: plcId }));
            }
        }
        // Add UDT groups from hierarchical structure
        if (plc.udtGroups && plc.udtGroups.length > 0) {
            for (const group of plc.udtGroups) {
                items.push(new TiaTreeItem_1.TiaTreeItem(group.name, group.id, // Use group.id directly (now contains full path)
                'udtGroup', vscode.TreeItemCollapsibleState.Collapsed, plcId, { groupName: group.name, groupData: group, groupPath: '', plcId: plcId }));
            }
        }
        // Add Watch Table groups from hierarchical structure
        if (plc.watchTableGroups && plc.watchTableGroups.length > 0) {
            for (const group of plc.watchTableGroups) {
                items.push(new TiaTreeItem_1.TiaTreeItem(group.name, group.id, // Use group.id directly (now contains full path)
                'watchTableGroup', vscode.TreeItemCollapsibleState.Collapsed, plcId, { groupName: group.name, groupData: group, groupPath: '', plcId: plcId }));
            }
        }
        return items;
    }
    /**
     * Get HMI content folders (Screens, Tags, Connections)
     */
    getHmiContentsItems(hmiId, deviceId, project) {
        const device = project.devices.find(d => d.id === deviceId);
        const hmi = device?.hmiSoftware.find(h => h.id === hmiId);
        if (!hmi) {
            return [];
        }
        const items = [];
        // Add Screens folder (contains screen groups and root-level screens)
        const hasScreens = (hmi.screenGroups && hmi.screenGroups.length > 0) ||
            (hmi.screens && hmi.screens.length > 0);
        if (hasScreens) {
            items.push(new TiaTreeItem_1.TiaTreeItem('Screens', `${hmiId}/Screens`, 'hmiScreensFolder', vscode.TreeItemCollapsibleState.Collapsed, hmiId, { hmi: hmi, hmiId: hmiId, deviceId: deviceId }));
        }
        // Add HMI Tags folder (contains tag groups and root-level tags)
        const hasTags = (hmi.tagGroups && hmi.tagGroups.length > 0) ||
            (hmi.tags && hmi.tags.length > 0);
        if (hasTags) {
            items.push(new TiaTreeItem_1.TiaTreeItem('HMI Tags', `${hmiId}/HMI Tags`, 'hmiTagsFolder', vscode.TreeItemCollapsibleState.Collapsed, hmiId, { hmi: hmi, hmiId: hmiId, deviceId: deviceId }));
        }
        // Add Connections folder
        if (hmi.connections && hmi.connections.length > 0) {
            items.push(new TiaTreeItem_1.TiaTreeItem('Connections', `${hmiId}/Connections`, 'hmiConnectionsFolder', vscode.TreeItemCollapsibleState.Collapsed, hmiId, { connections: hmi.connections, hmiId: hmiId, deviceId: deviceId }));
        }
        return items;
    }
    /**
     * Get HMI Screens folder contents
     */
    getHmiScreensFolderItems(hmiId, project, metadata) {
        const hmi = metadata?.hmi;
        if (!hmi) {
            return [];
        }
        const items = [];
        // Retrieve deviceId from metadata (passed from getHmiContentsItems)
        const deviceId = metadata?.deviceId;
        // Add screen groups
        if (hmi.screenGroups) {
            for (const group of hmi.screenGroups) {
                const hasChildren = (group.screens && group.screens.length > 0) ||
                    (group.subGroups && group.subGroups.length > 0);
                items.push(new TiaTreeItem_1.TiaTreeItem(group.name, group.id, 'hmiScreenGroup', hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, hmiId, { groupData: group, hmiId: hmiId, deviceId: deviceId }));
            }
        }
        // Add root-level screens
        if (hmi.screens) {
            for (const screen of hmi.screens) {
                items.push(new TiaTreeItem_1.TiaTreeItem(screen.name, screen.id, 'hmiScreen', vscode.TreeItemCollapsibleState.None, hmiId, { deviceId: deviceId }));
            }
        }
        return items;
    }
    /**
     * Get HMI Tags folder contents
     */
    getHmiTagsFolderItems(hmiId, project, metadata) {
        const hmi = metadata?.hmi;
        if (!hmi) {
            return [];
        }
        const items = [];
        const deviceId = metadata?.deviceId;
        // Add tag groups
        if (hmi.tagGroups) {
            for (const group of hmi.tagGroups) {
                const hasChildren = (group.tags && group.tags.length > 0) ||
                    (group.subGroups && group.subGroups.length > 0);
                items.push(new TiaTreeItem_1.TiaTreeItem(group.name, group.id, 'hmiTagGroup', hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, hmiId, { groupData: group, hmiId: hmiId, deviceId: deviceId }));
            }
        }
        // Add root-level tags
        if (hmi.tags) {
            for (const tag of hmi.tags) {
                items.push(new TiaTreeItem_1.TiaTreeItem(tag.name, tag.id, 'hmiTag', vscode.TreeItemCollapsibleState.None, hmiId, { deviceId: deviceId }));
            }
        }
        return items;
    }
    /**
     * Get HMI screen group contents (screens and subgroups)
     */
    getHmiScreenGroupItems(groupId, parentId, project, metadata) {
        const groupData = metadata?.groupData;
        const hmiId = metadata?.hmiId || parentId;
        const deviceId = metadata?.deviceId;
        if (!groupData) {
            return [];
        }
        const items = [];
        // Add subgroups
        if (groupData.subGroups) {
            for (const subGroup of groupData.subGroups) {
                const hasChildren = (subGroup.screens && subGroup.screens.length > 0) ||
                    (subGroup.subGroups && subGroup.subGroups.length > 0);
                items.push(new TiaTreeItem_1.TiaTreeItem(subGroup.name, subGroup.id, 'hmiScreenGroup', hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, groupId, { groupData: subGroup, hmiId: hmiId, deviceId: deviceId }));
            }
        }
        // Add screens
        if (groupData.screens) {
            for (const screen of groupData.screens) {
                items.push(new TiaTreeItem_1.TiaTreeItem(screen.name, screen.id, 'hmiScreen', vscode.TreeItemCollapsibleState.None, groupId, { deviceId: deviceId }));
            }
        }
        return items;
    }
    /**
     * Get HMI tag group contents (tags and subgroups)
     */
    getHmiTagGroupItems(groupId, parentId, project, metadata) {
        const groupData = metadata?.groupData;
        const hmiId = metadata?.hmiId || parentId;
        const deviceId = metadata?.deviceId;
        if (!groupData) {
            return [];
        }
        const items = [];
        // Add subgroups
        if (groupData.subGroups) {
            for (const subGroup of groupData.subGroups) {
                const hasChildren = (subGroup.tags && subGroup.tags.length > 0) ||
                    (subGroup.subGroups && subGroup.subGroups.length > 0);
                items.push(new TiaTreeItem_1.TiaTreeItem(subGroup.name, subGroup.id, 'hmiTagGroup', hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, groupId, { groupData: subGroup, hmiId: hmiId, deviceId: deviceId }));
            }
        }
        // Add tags
        if (groupData.tags) {
            for (const tag of groupData.tags) {
                items.push(new TiaTreeItem_1.TiaTreeItem(tag.name, tag.id, 'hmiTag', vscode.TreeItemCollapsibleState.None, groupId, { deviceId: deviceId }));
            }
        }
        return items;
    }
    /**
     * Get HMI connection items
     */
    getHmiConnectionItems(metadata) {
        const connections = metadata?.connections;
        const hmiId = metadata?.hmiId;
        if (!connections) {
            return [];
        }
        return connections.map(conn => new TiaTreeItem_1.TiaTreeItem(conn.name, conn.id, 'hmiConnection', vscode.TreeItemCollapsibleState.None, hmiId, { partner: conn.partner }));
    }
    /**
     * Get block group contents (blocks and subgroups)
     */
    getBlockGroupItems(groupId, parentPath, project, parentGroupPath = '', metadata) {
        // parentPath is the plcId which contains the full path deviceId/plcName
        const plcId = metadata?.plcId || parentPath;
        const deviceId = plcId.split('/')[0]; // First segment is device ID
        const device = project.devices.find(d => d.id === deviceId);
        const plc = device?.plcSoftware.find(p => p.id === plcId);
        if (!plc) {
            return [];
        }
        const group = (0, treeHelpers_1.findBlockGroup)(plc.blockGroups, groupId);
        if (!group) {
            return [];
        }
        // Build the current group path (relative to the main group, not including it)
        // For main groups (parentGroupPath is empty), currentGroupPath is empty
        // For subgroups, it's the path from the subgroup level
        const currentGroupPath = parentGroupPath;
        const items = [];
        // Add subgroups
        for (const subgroup of group.subGroups || []) {
            // Build subgroup path: if we're at root, just use subgroup name, otherwise append
            const subgroupPath = currentGroupPath ? `${currentGroupPath}/${subgroup.name}` : subgroup.name;
            items.push(new TiaTreeItem_1.TiaTreeItem(subgroup.name, subgroup.id, 'blockGroup', vscode.TreeItemCollapsibleState.Collapsed, plcId, { groupName: subgroup.name, groupPath: subgroupPath, plcId: plcId }));
        }
        // Add blocks
        for (const block of group.blocks) {
            const label = (0, treeHelpers_1.getBlockLabel)(block);
            items.push(new TiaTreeItem_1.TiaTreeItem(label, block.id, 'block', vscode.TreeItemCollapsibleState.None, plcId, {
                blockType: block.type,
                blockNumber: block.number,
                language: block.language,
                groupPath: currentGroupPath || '',
                plcId: plcId
            }));
        }
        return items;
    }
    /**
     * Get tag table group contents (tables and subgroups)
     */
    getTagTableGroupItems(groupId, parentPath, project, parentGroupPath = '', metadata) {
        // parentPath is the plcId which contains the full path deviceId/plcName
        const plcId = metadata?.plcId || parentPath;
        const deviceId = plcId.split('/')[0]; // First segment is device ID
        const device = project.devices.find(d => d.id === deviceId);
        const plc = device?.plcSoftware.find(p => p.id === plcId);
        if (!plc || !plc.tagTableGroups) {
            return [];
        }
        const group = (0, treeHelpers_1.findTagTableGroup)(plc.tagTableGroups, groupId);
        if (!group) {
            return [];
        }
        // Build the current group path (relative to the main group, not including it)
        const currentGroupPath = parentGroupPath;
        const items = [];
        // Add subgroups
        for (const subgroup of group.subGroups || []) {
            const subgroupPath = currentGroupPath ? `${currentGroupPath}/${subgroup.name}` : subgroup.name;
            items.push(new TiaTreeItem_1.TiaTreeItem(subgroup.name, subgroup.id, 'tagTableGroup', vscode.TreeItemCollapsibleState.Collapsed, plcId, { groupName: subgroup.name, groupData: subgroup, groupPath: subgroupPath, plcId: plcId }));
        }
        // Add tag tables
        for (const table of group.tagTables || []) {
            items.push(new TiaTreeItem_1.TiaTreeItem(table.name, table.id, 'tagTable', vscode.TreeItemCollapsibleState.None, plcId, { groupPath: currentGroupPath || '', plcId: plcId }));
        }
        return items;
    }
    /**
     * Get UDT group contents (UDTs and subgroups)
     */
    getUdtGroupItems(groupId, parentPath, project, parentGroupPath = '', metadata) {
        // parentPath is the plcId which contains the full path deviceId/plcName
        const plcId = metadata?.plcId || parentPath;
        const deviceId = plcId.split('/')[0]; // First segment is device ID
        const device = project.devices.find(d => d.id === deviceId);
        const plc = device?.plcSoftware.find(p => p.id === plcId);
        if (!plc || !plc.udtGroups) {
            return [];
        }
        const group = (0, treeHelpers_1.findUdtGroup)(plc.udtGroups, groupId);
        if (!group) {
            return [];
        }
        // Build the current group path (relative to the main group, not including it)
        const currentGroupPath = parentGroupPath;
        const items = [];
        // Add subgroups
        for (const subgroup of group.subGroups || []) {
            const subgroupPath = currentGroupPath ? `${currentGroupPath}/${subgroup.name}` : subgroup.name;
            items.push(new TiaTreeItem_1.TiaTreeItem(subgroup.name, subgroup.id, 'udtGroup', vscode.TreeItemCollapsibleState.Collapsed, plcId, { groupName: subgroup.name, groupData: subgroup, groupPath: subgroupPath, plcId: plcId }));
        }
        // Add UDTs
        for (const udt of group.udts || []) {
            items.push(new TiaTreeItem_1.TiaTreeItem(udt.name, udt.id, 'udt', vscode.TreeItemCollapsibleState.None, plcId, { groupPath: currentGroupPath || '', plcId: plcId }));
        }
        return items;
    }
    /**
     * Get watch table group contents (tables and subgroups)
     */
    getWatchTableGroupItems(groupId, parentPath, project, parentGroupPath = '', metadata) {
        // parentPath is the plcId which contains the full path deviceId/plcName
        const plcId = metadata?.plcId || parentPath;
        const deviceId = plcId.split('/')[0]; // First segment is device ID
        const device = project.devices.find(d => d.id === deviceId);
        const plc = device?.plcSoftware.find(p => p.id === plcId);
        if (!plc || !plc.watchTableGroups) {
            return [];
        }
        const group = (0, treeHelpers_1.findWatchTableGroup)(plc.watchTableGroups, groupId);
        if (!group) {
            return [];
        }
        // Build the current group path (relative to the main group, not including it)
        const currentGroupPath = parentGroupPath;
        const items = [];
        // Add subgroups
        for (const subgroup of group.subGroups || []) {
            const subgroupPath = currentGroupPath ? `${currentGroupPath}/${subgroup.name}` : subgroup.name;
            items.push(new TiaTreeItem_1.TiaTreeItem(subgroup.name, subgroup.id, 'watchTableGroup', vscode.TreeItemCollapsibleState.Collapsed, plcId, { groupName: subgroup.name, groupData: subgroup, groupPath: subgroupPath, plcId: plcId }));
        }
        // Add watch tables
        for (const table of group.watchTables || []) {
            items.push(new TiaTreeItem_1.TiaTreeItem(table.name, table.id, 'watchTable', vscode.TreeItemCollapsibleState.None, plcId, { groupPath: currentGroupPath || '', plcId: plcId }));
        }
        return items;
    }
    /**
     * Get Project Library folder contents (sub-folders + master copies).
     */
    getLibraryFolderItems(metadata) {
        const folder = metadata?.folderData;
        if (!folder) {
            return [];
        }
        const items = [];
        // Sub-folders
        for (const sub of folder.folders || []) {
            const hasChildren = (sub.folders && sub.folders.length > 0) ||
                (sub.masterCopies && sub.masterCopies.length > 0);
            items.push(new TiaTreeItem_1.TiaTreeItem(sub.name, sub.id, 'libraryFolder', hasChildren
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None, folder.id, { folderData: sub }));
        }
        // Master copies (leaves)
        for (const mc of folder.masterCopies || []) {
            items.push(new TiaTreeItem_1.TiaTreeItem(mc.name, mc.id, 'masterCopy', vscode.TreeItemCollapsibleState.None, folder.id, {
                masterCopyKind: mc.kind,
                contentTypes: mc.contentTypes,
                author: mc.author
            }));
        }
        return items;
    }
    /**
     * Children of the virtual "Project library" root node — at most two
     * sections (Master copies, Types). Each section is shown only when it
     * has any content.
     */
    getLibraryRootChildren(metadata) {
        const masterCopies = metadata?.masterCopies;
        const libraryTypes = metadata?.libraryTypes;
        const items = [];
        if (masterCopies) {
            items.push(new TiaTreeItem_1.TiaTreeItem(masterCopies.name || 'Master copies', masterCopies.id, 'libraryFolder', vscode.TreeItemCollapsibleState.Collapsed, undefined, { folderData: masterCopies, isLibraryRoot: true }));
        }
        if (libraryTypes) {
            items.push(new TiaTreeItem_1.TiaTreeItem(libraryTypes.name || 'Types', libraryTypes.id, 'libraryTypeFolder', vscode.TreeItemCollapsibleState.Collapsed, undefined, { folderData: libraryTypes, isLibraryRoot: true }));
        }
        return items;
    }
    /**
     * Get Project Library > Types folder contents (sub-folders + library types).
     */
    getLibraryTypeFolderItems(metadata) {
        const folder = metadata?.folderData;
        if (!folder) {
            return [];
        }
        const items = [];
        for (const sub of folder.folders || []) {
            const hasChildren = (sub.folders && sub.folders.length > 0) ||
                (sub.types && sub.types.length > 0);
            items.push(new TiaTreeItem_1.TiaTreeItem(sub.name, sub.id, 'libraryTypeFolder', hasChildren
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None, folder.id, {
                folderData: sub,
                folderPath: stripLibraryTypesPrefix(sub.id)
            }));
        }
        for (const t of folder.types || []) {
            const versionSuffix = t.versionCount > 0 ? ` (v${t.versionCount})` : '';
            items.push(new TiaTreeItem_1.TiaTreeItem(`${t.name}${versionSuffix}`, t.id, 'libraryType', vscode.TreeItemCollapsibleState.None, folder.id, {
                namespace: t.namespace,
                author: t.author,
                versionCount: t.versionCount,
                folderPath: stripLibraryTypesPrefix(folder.id),
                typeName: t.name
            }));
        }
        return items;
    }
}
exports.TiaProjectTreeProvider = TiaProjectTreeProvider;
function stripLibraryTypesPrefix(id) {
    if (!id)
        return '';
    const normalized = id.replace(/\\/g, '/');
    if (normalized === 'Library/Types')
        return '';
    if (normalized.startsWith('Library/Types/'))
        return normalized.substring('Library/Types/'.length);
    return normalized;
}
//# sourceMappingURL=projectTreeProvider.js.map