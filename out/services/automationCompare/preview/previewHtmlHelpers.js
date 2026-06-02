"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTrailingSlash = withTrailingSlash;
exports.safeScriptJson = safeScriptJson;
exports.escapeHtml = escapeHtml;
exports.hasFailSafeLogicPayload = hasFailSafeLogicPayload;
exports.createNonce = createNonce;
function withTrailingSlash(value) {
    return value.endsWith('/') ? value : `${value}/`;
}
function safeScriptJson(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function hasFailSafeLogicPayload(leftPayload, rightPayload) {
    return isFailSafeLadOrFbdContent(leftPayload.content)
        || Boolean(rightPayload && isFailSafeLadOrFbdContent(rightPayload.content));
}
function isFailSafeLadOrFbdContent(content) {
    const failSafeLogicLanguage = 'F[_\\-\\s]?(?:LAD|FBD)(?:[_\\-\\s]?LIB)?';
    return new RegExp(`(?:<ProgrammingLanguage>\\s*${failSafeLogicLanguage}\\s*<\\/ProgrammingLanguage>`
        + `|\\bProgrammingLanguage\\s*=\\s*["']${failSafeLogicLanguage}["']`
        + `|\\bS7_Language\\s*:=\\s*["']${failSafeLogicLanguage}["'])`, 'i').test(content);
}
function createNonce() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let index = 0; index < 32; index++) {
        nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return nonce;
}
//# sourceMappingURL=previewHtmlHelpers.js.map