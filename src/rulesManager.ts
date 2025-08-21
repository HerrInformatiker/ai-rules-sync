/**
 * Main orchestrator for AI rules synchronization.
 * Coordinates configuration management, Git operations, file syncing,
 * periodic updates, error handling, and user interactions.
 */
import * as vscode from 'vscode';
import { ConfigManager } from './configManager';
import { GitManager } from './gitManager';
import { FileSyncer } from './fileSyncer';

export class RulesManager {
    private configManager: ConfigManager;
    private gitManager: GitManager;
    private fileSyncer: FileSyncer;
    private syncTimer: NodeJS.Timeout | undefined;
    private isDisposed = false;

    constructor(
        context: vscode.ExtensionContext,
        private logger: vscode.LogOutputChannel
    ) {
        this.configManager = new ConfigManager();
        this.gitManager = new GitManager(this.logger);
        this.fileSyncer = new FileSyncer(this.logger);

        // Ensure computed defaults are set in VS Code settings
        this.configManager.ensureDefaults().catch(error => {
            this.logger.warn('Failed to set default configuration values', error);
        });

        // Watch for configuration changes
        vscode.workspace.onDidChangeConfiguration(this.onConfigChanged, this, context.subscriptions);
    }

    public async performInitialSetup(): Promise<void> {
        try {
            this.logger.info('Checking configuration...');

            if (!this.configManager.isConfigured()) {
                this.logger.info('Extension not configured; prompting to open settings');
                const action = await vscode.window.showWarningMessage(
                    'AI Rules Syncer is not configured. Open settings to configure now?',
                    'Open Settings',
                    'Cancel'
                );
                if (action === 'Open Settings') {
                    await vscode.commands.executeCommand('workbench.action.openSettings', 'aiRulesSyncer');
                }
                // Do not proceed with sync or timers when not configured
                return;
            }

            // Validate before attempting any sync
            const initialConfig = this.configManager.getConfig();
            const initialErrors = this.configManager.validateConfig(initialConfig);
            if (initialErrors.length > 0) {
                const message = `Configuration invalid: ${initialErrors.join(', ')}`;
                this.logger.warn(message);
                vscode.window.showWarningMessage(message);
                // Do not set up periodic sync until configuration is valid
                return;
            }

            this.logger.info('Configuration valid, starting initial sync...');
            await this.syncRules();
            this.setupPeriodicSync();
        } catch (error) {
            this.logger.error('Initial setup failed', error);

            // Check if it's a repository access error
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('Repository not found') ||
                errorMessage.includes('Could not read from remote repository') ||
                errorMessage.includes('Authentication failed') ||
                errorMessage.includes('Git clone failed')) {

                this.logger.warn('Repository access failed, offering reconfiguration');
                await this.offerReconfiguration(errorMessage);
            } else {
                await this.handleSyncError(error as Error, true);
            }
        }
    }

    public async performInitialSync(): Promise<void> {
        try {
            this.logger.info('Starting initial sync...');
            await this.syncRules();
            this.setupPeriodicSync();
        } catch (error) {
            this.logger.error('Initial sync failed', error);
            await this.handleSyncError(error as Error, true);
        }
    }

    public async syncRules(): Promise<void> {
        if (this.isDisposed) {
            return;
        }

        if (!this.configManager.isConfigured()) {
            const action = await vscode.window.showWarningMessage(
                'AI Rules Syncer is not configured. Open settings to configure now?',
                'Open Settings',
                'Cancel'
            );
            if (action === 'Open Settings') {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'aiRulesSyncer');
            }
            return;
        }

        const config = this.configManager.getConfig();
        const errors = this.configManager.validateConfig(config);
        if (errors.length > 0) {
            const message = `Configuration invalid: ${errors.join(', ')}`;
            this.logger.warn(message);
            vscode.window.showWarningMessage(message);
            return;
        }

        try {
            this.logger.info(`Syncing rules from ${config.repoUrl}`);

            // Ensure cache directory exists and get repository path
            const { repoPath, actualBranch } = await this.gitManager.ensureRepository(config);

            // Set branch default if we discovered the actual branch
            if (actualBranch) {
                await this.configManager.setBranchDefault(actualBranch, this.logger);
            }

            // Sync files from repository to workspace
            await this.fileSyncer.syncFiles(repoPath, config);

            this.logger.info('Rules sync completed successfully');
        } catch (error) {
            this.logger.error('Sync failed', error);
            throw error;
        }
    }

    private async handleSyncError(error: Error, isFirstTime: boolean): Promise<void> {
        if (isFirstTime) {
            // Show blocking modal for first-time failures
            const action = await vscode.window.showErrorMessage(
                `Failed to sync AI rules: ${error.message}`,
                { modal: true },
                'Retry',
                'Work with local copy'
            );

            if (action === 'Retry') {
                return this.performInitialSync();
            } else if (action === 'Work with local copy') {
                // Try to use existing cached content if available
                try {
                    const config = this.configManager.getConfig();
                    const repoPath = this.gitManager.getRepositoryPath(config);
                    if (await this.fileSyncer.hasExistingContent(repoPath)) {
                        await this.fileSyncer.syncFiles(repoPath, config);
                        this.logger.info('Using existing cached rules');
                    } else {
                        vscode.window.showWarningMessage('No rules available; working without rules');
                    }
                } catch (fallbackError) {
                    this.logger.error('Fallback to cached rules failed', fallbackError);
                    vscode.window.showWarningMessage('No rules available; working without rules');
                }
            }
        } else {
            // Non-blocking notification for subsequent failures
            vscode.window.showWarningMessage(`Failed to sync rules: ${error.message}`);
        }
    }



    private onConfigChanged(event: vscode.ConfigurationChangeEvent): void {
        if (event.affectsConfiguration('aiRulesSyncer')) {
            this.logger.info('Configuration changed, applying updates...');

            // Check which specific settings changed
            const changedSettings = [
                'aiRulesSyncer.repoUrl',
                'aiRulesSyncer.teamNames',
                'aiRulesSyncer.branch',
                'aiRulesSyncer.syncIntervalMinutes',
                'aiRulesSyncer.cacheDirPath',
                'aiRulesSyncer.rulesFolderPath'
            ].filter(setting => event.affectsConfiguration(setting));

            this.logger.debug(`Changed settings: ${changedSettings.join(', ')}`);

            // Update periodic sync (handles syncIntervalMinutes changes)
            this.setupPeriodicSync();

            // If relevant settings changed, trigger a full sync immediately.
            // Includes repository, team, branch, destination folder and cache location changes.
            const resyncSettings = [
                'aiRulesSyncer.repoUrl',
                'aiRulesSyncer.teamNames',
                'aiRulesSyncer.branch',
                'aiRulesSyncer.rulesFolderPath',
                'aiRulesSyncer.cacheDirPath'
            ];
            if (changedSettings.some(setting => resyncSettings.includes(setting))) {
                this.logger.info('Relevant settings changed, triggering sync...');
                this.syncRules().catch(error => {
                    this.handleSyncError(error as Error, false);
                });
            }
        }
    }

    private setupPeriodicSync(): void {
        // Clear existing timer
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = undefined;
        }

        const config = this.configManager.getConfig();
        const errors = this.configManager.validateConfig(config);
        if (errors.length > 0) {
            this.logger.warn(`Skipping periodic sync due to invalid configuration: ${errors.join(', ')}`);
            return;
        }

        if (config.syncIntervalMinutes > 0) {
            this.logger.info(`Setting up periodic sync every ${config.syncIntervalMinutes} minutes`);
            this.syncTimer = setInterval(async () => {
                try {
                    await this.syncRules();
                } catch (error) {
                    await this.handleSyncError(error as Error, false);
                }
            }, config.syncIntervalMinutes * 60 * 1000);
        }
    }

    private async offerReconfiguration(errorMessage: string): Promise<void> {
        const action = await vscode.window.showWarningMessage(
            `Failed to access AI rules repository: ${errorMessage}`,
            'Open Settings',
            'Work with Local Copy'
        );

        if (action === 'Open Settings') {
            await vscode.commands.executeCommand('workbench.action.openSettings', 'aiRulesSyncer.repoUrl');
        } else if (action === 'Work with Local Copy') {
            // Attempt to use cached rules immediately, mirroring first-time error fallback
            try {
                const config = this.configManager.getConfig();
                const repoPath = this.gitManager.getRepositoryPath(config);
                if (await this.fileSyncer.hasExistingContent(repoPath)) {
                    await this.fileSyncer.syncFiles(repoPath, config);
                    this.logger.info('Using existing cached rules');
                    vscode.window.showInformationMessage('Using existing cached AI rules. You can reconfigure the repository later.');
                } else {
                    vscode.window.showWarningMessage('No cached rules available; working without rules. You can reconfigure the repository later.');
                }
            } catch (fallbackError) {
                this.logger.error('Fallback to cached rules failed', fallbackError as Error);
                vscode.window.showWarningMessage('No rules available; working without rules. You can reconfigure the repository later.');
            }
        }
    }

    public async showCurrentConfiguration(): Promise<void> {
        const config = this.configManager.getConfig();
        const effectiveConfig = this.configManager.getEffectiveConfiguration();

        let message = '**Current AI Rules Configuration:**\n\n';
        message += `**Repository URL:** ${config.repoUrl || '(not configured)'}\n`;
        message += `**Team Names:** ${config.teamNames.length > 0 ? config.teamNames.join(', ') : '(none)'}\n`;
        message += `**Rules Folder:** ${config.rulesFolderPath}\n`;
        message += `**Sync Interval:** ${config.syncIntervalMinutes === 0 ? 'disabled' : `${config.syncIntervalMinutes} minutes`}\n\n`;

        message += '**Computed Defaults:**\n';
        effectiveConfig.forEach(item => {
            const defaultText = item.isDefault ? ' *(default)*' : '';
            message += `**${item.setting}:** ${item.value}${defaultText}\n`;
        });

        const plainMessage = message.replace(/\*\*/g, '');
        await vscode.window.showInformationMessage(plainMessage, { modal: true }, 'OK');
    }

    public async showConfigurationWizard(): Promise<void> {
        try {
            const steps = this.configManager.getRequiredConfigurationSteps();

            if (steps.length === 0) {
                vscode.window.showInformationMessage('AI Rules Syncer is already configured!');
                return;
            }

            const action = await vscode.window.showInformationMessage(
                'AI Rules Syncer needs to be configured to sync your team\'s rules.',
                { modal: true },
                'Configure Now',
                'Open Settings'
            );

            if (action === 'Configure Now') {
                await this.promptForRepositoryUrl();
            } else if (action === 'Open Settings') {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'aiRulesSyncer');
            }
        } catch (error) {
            this.logger.error('Configuration wizard failed', error);
            vscode.window.showErrorMessage(`Configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async promptForRepositoryUrl(): Promise<void> {
        const repoUrl = await vscode.window.showInputBox({
            prompt: 'Enter your AI rules repository URL',
            placeHolder: 'e.g., git@github.com:YourOrg/ai-coding-rules.git or https://github.com/YourOrg/ai-coding-rules.git',
            validateInput: (value: string) => {
                if (!value.trim()) {
                    return 'Repository URL is required';
                }
                const urlPattern = /^(https?:\/\/|git@)/;
                if (!urlPattern.test(value)) {
                    return 'Please enter a valid HTTPS or SSH Git URL';
                }
                return undefined;
            }
        });

        if (repoUrl) {
            // Save the configuration
            const config = vscode.workspace.getConfiguration('aiRulesSyncer');
            await config.update('repoUrl', repoUrl, vscode.ConfigurationTarget.Workspace);

            vscode.window.showInformationMessage('Repository URL configured! Starting initial sync...');

            // Perform initial sync now that we're configured
            try {
                await this.performInitialSync();
                vscode.window.showInformationMessage('AI rules synced successfully!');
            } catch (error) {
                await this.handleSyncError(error as Error, true);
            }
        }
    }

    public dispose(): void {
        this.isDisposed = true;
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = undefined;
        }
        this.gitManager.dispose();
    }
}