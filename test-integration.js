#!/usr/bin/env node

/**
 * Simple integration test script for the AI Rules Syncer extension
 * This script validates the compiled JavaScript files and basic functionality
 */

const fs = require('fs');
const path = require('path');

// Test that all required files were compiled
const requiredFiles = [
    'out/extension.js',
    'out/configManager.js',
    'out/rulesManager.js',
    'out/gitManager.js',
    'out/fileSyncer.js'
];

console.log('🧪 Running integration tests...\n');

// Test 1: Check compiled files exist
console.log('Test 1: Checking compiled files...');
for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
        console.log(`  ✅ ${file} exists`);
    } else {
        console.error(`  ❌ ${file} missing`);
        process.exit(1);
    }
}

// Test 2: Check that JavaScript files are valid
console.log('\nTest 2: Checking JavaScript syntax...');
try {
    // Only test syntax, don't actually load modules that depend on vscode
    const vm = require('vm');
    for (const file of requiredFiles) {
        const code = fs.readFileSync(file, 'utf8');
        new vm.Script(code); // This will throw if syntax is invalid
    }
    console.log('  ✅ All JavaScript files have valid syntax');
} catch (error) {
    console.error(`  ❌ JavaScript syntax check failed: ${error.message}`);
    process.exit(1);
}

// Test 3: Check dependencies are available
console.log('\nTest 3: Checking dependencies...');
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const dependencies = packageJson.dependencies || {};

    for (const dep in dependencies) {
        try {
            require.resolve(dep);
            console.log(`  ✅ Dependency ${dep} is available`);
        } catch (error) {
            console.error(`  ❌ Dependency ${dep} not found`);
            process.exit(1);
        }
    }
} catch (error) {
    console.error(`  ❌ Dependency check failed: ${error.message}`);
    process.exit(1);
}

// Test 4: Check package.json structure
console.log('\nTest 4: Validating package.json...');
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

    const requiredFields = ['name', 'displayName', 'main', 'contributes', 'activationEvents'];
    for (const field of requiredFields) {
        if (packageJson[field]) {
            console.log(`  ✅ package.json has ${field}`);
        } else {
            console.error(`  ❌ package.json missing ${field}`);
            process.exit(1);
        }
    }

    // Check if main file exists
    if (fs.existsSync(packageJson.main)) {
        console.log(`  ✅ Main file ${packageJson.main} exists`);
    } else {
        console.error(`  ❌ Main file ${packageJson.main} missing`);
        process.exit(1);
    }
} catch (error) {
    console.error(`  ❌ package.json validation failed: ${error.message}`);
    process.exit(1);
}

console.log('\n🎉 All integration tests passed!');
console.log('\n📋 Next steps:');
console.log('  1. Install the extension in VS Code for manual testing');
console.log('  2. Configure a test repository URL');
console.log('  3. Test the refresh command');
console.log('  4. Check the output logs in "AI Rules Syncer" channel');