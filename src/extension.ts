/**
 * Main entry point for the AI Rules Syncer VS Code extension.
 * Handles extension activation, command registration, and lifecycle management.
 */
import * as vscode from 'vscode';
import { RulesManager } from './rulesManager';

let rulesManager: RulesManager | undefined;

export function activate(context: vscode.ExtensionContext) {
    // Create log output channel for logging
    const logChannel = vscode.window.createOutputChannel('AI Rules Syncer', { log: true });

    // Guard: Skip activation when no workspace folder is open
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        logChannel.info('No workspace folder found. AI Rules Syncer extension will not activate.');
        return;
    }

    console.log('AI Rules Syncer extension is now active!');

    // Initialize the rules manager
    rulesManager = new RulesManager(context, logChannel);

    // Register commands
    const refreshCommand = vscode.commands.registerCommand('aiRulesSyncer.refreshRules', async () => {
        try {
            await rulesManager?.syncRules();
            vscode.window.showInformationMessage('AI Rules refreshed successfully');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to refresh rules: ${message}`);
        }
    });

    const configureCommand = vscode.commands.registerCommand('aiRulesSyncer.configure', async () => {
        try {
            await vscode.commands.executeCommand('workbench.action.openSettings', 'aiRulesSyncer');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to open settings: ${message}`);
        }
    });

    const openSettingsCommand = vscode.commands.registerCommand('aiRulesSyncer.openSettings', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'aiRulesSyncer');
    });

    const showConfigCommand = vscode.commands.registerCommand('aiRulesSyncer.showConfiguration', async () => {
        try {
            await rulesManager?.showCurrentConfiguration();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to show configuration: ${message}`);
        }
    });

    context.subscriptions.push(refreshCommand, configureCommand, openSettingsCommand, showConfigCommand);

    // Perform initial setup on activation (includes configuration check)
    (async () => {
        try {
            await rulesManager.performInitialSetup();
        } catch (error) {
            logChannel.error('Extension activation failed:', error);
        }
    })();
}

export function deactivate() {
    rulesManager?.dispose();
}