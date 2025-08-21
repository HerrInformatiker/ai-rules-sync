// Provides a minimal stub for the 'vscode' module when running Node.js unit tests
// so that requiring it does not throw.

const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function patchedRequire(path, ...args) {
    if (path === 'vscode') {
        // Return an empty object stub; extend with mocks if needed.
        return {};
    }
    return originalRequire.call(this, path, ...args);
};

