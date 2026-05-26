"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockLabel = getBlockLabel;
exports.findBlockGroup = findBlockGroup;
exports.findTagTableGroup = findTagTableGroup;
exports.findUdtGroup = findUdtGroup;
exports.findWatchTableGroup = findWatchTableGroup;
/**
 * Display label for a PLC block, used as the tree node label.
 */
function getBlockLabel(block) {
    return `${block.name} [${block.type}${block.number}]`;
}
/**
 * Generic recursive search over any "group" hierarchy that exposes `id` and
 * `subGroups`. This collapses the 4 near-identical find* methods from the old
 * monolithic tree provider.
 */
function findGroup(groups, groupId) {
    if (!groups) {
        return undefined;
    }
    for (const group of groups) {
        if (group.id === groupId) {
            return group;
        }
        const found = findGroup(group.subGroups, groupId);
        if (found) {
            return found;
        }
    }
    return undefined;
}
function findBlockGroup(groups, groupId) {
    return findGroup(groups, groupId);
}
function findTagTableGroup(groups, groupId) {
    return findGroup(groups, groupId);
}
function findUdtGroup(groups, groupId) {
    return findGroup(groups, groupId);
}
function findWatchTableGroup(groups, groupId) {
    return findGroup(groups, groupId);
}
//# sourceMappingURL=treeHelpers.js.map