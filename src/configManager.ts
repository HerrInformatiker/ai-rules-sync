/**
 * Configuration manager for the AI Rules Syncer extension.
 * Handles reading, validating, and processing VS Code settings for the extension,
 * including repository URLs, team configurations, and sync preferences.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export interface RulesConfig {
    repoUrl: string;
    teamNames: string[];
    rulesFolderPath: string;
    cacheDirPath: string;
    syncIntervalMinutes: number;
    branch: string;
}

export class ConfigManager {
    /**
     * Read the current VS Code settings, apply normalisation rules and return
     * a {@link RulesConfig} object ready for consumption by other services.
     */
    public getConfig(): RulesConfig {
        const config = vscode.workspace.getConfiguration('aiRulesSyncer');

        // Handle teamNames - string or array of strings
        const rawTeamNames = config.get<string | string[]>('teamNames', '');
        const teamNames = Array.isArray(rawTeamNames)
            ? rawTeamNames.map(s => s.trim()).filter(Boolean)
            : rawTeamNames.split(',').map(s => s.trim()).filter(Boolean);

        // Get cache directory with OS-specific defaults
        const cacheDirPath = config.get<string>('cacheDirPath') || this.getDefaultCacheDir();

        // Get rules folder path relative to workspace
        const rulesFolderSetting = config.get<string>('rulesFolderPath', '.cursor/rules/remote');

        // Get branch - use empty string if not set (indicates using repo default)
        const branch = config.get<string>('branch', '');

        return {
            repoUrl: config.get<string>('repoUrl', ''),
            teamNames,
            rulesFolderPath: this.resolveRulesFolderPath(rulesFolderSetting),
            cacheDirPath,
            syncIntervalMinutes: config.get<number>('syncIntervalMinutes', 0),
            branch
        };
    }

    /**
     * Determine the default location for the local cache directory based on
     * the host operating system.
     *
     * The method mirrors the recommended cache locations for each platform
     * (e.g. `~/.cache` on Linux, `~/Library/Caches` on macOS, and
     * `%LOCALAPPDATA%` on Windows).
     */
    private getDefaultCacheDir(): string {
        const platform = os.platform();
        const homeDir = os.homedir();

        switch (platform) {
            case 'linux':
                return path.join(homeDir, '.cache');
            case 'darwin': // macOS
                return path.join(homeDir, 'Library', 'Caches');
            case 'win32': // Windows
                const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
                return path.join(localAppData, 'ai-coding-rules');
            default:
                return path.join(homeDir, '.ai-coding-rules-cache');
        }
    }

    /**
     * Resolve the rules folder path to an absolute path.
     *
     * @param configuredPath  The path provided by the user (absolute or
     *                        workspace-relative).
     * @throws If no workspace folder is open when a relative path is given.
     */
    private resolveRulesFolderPath(configuredPath: string): string {
        // If it's already absolute, use as-is
        if (path.isAbsolute(configuredPath)) {
            return configuredPath;
        }

        // Resolve relative to workspace folder
        const workspaceFolder = vscode.workspace?.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found. Please open a workspace to use AI rules syncer')
        }

        return path.join(workspaceFolder.uri.fsPath, configuredPath);
    }

    public isConfigured(): boolean {
        const config = this.getConfig();
        const repoUrl = config.repoUrl.trim();
        if (repoUrl.length === 0) {
            return false;
        }

        // Basic URL validation
        const urlPattern = /^(https?:\/\/|git@)/;
        return urlPattern.test(repoUrl);
    }

    /**
     * Validate a {@link RulesConfig} instance and return an array of
     * human-readable error messages for any fields that fail validation.
     *
     * @param config The configuration object to validate.
     * @returns      An array of error strings; empty when the config is valid.
     */
    public validateConfig(config: RulesConfig): string[] {
        const errors: string[] = [];

        if (!config.repoUrl.trim()) {
            errors.push('Repository URL is required');
        } else {
            // Basic URL validation
            const urlPattern = /^(https?:\/\/|git@)/;
            if (!urlPattern.test(config.repoUrl)) {
                errors.push('Repository URL must be a valid HTTPS or SSH URL');
            }
        }

        if (config.syncIntervalMinutes < 0) {
            errors.push('Sync interval must be zero or positive');
        }

        // Safety guard: path must be a subfolder inside the workspace (not root, not outside)
        const workspaceFolder = vscode.workspace?.workspaceFolders?.[0];
        if (workspaceFolder) {
            try {
                const workspaceRootAbs = path.resolve(workspaceFolder.uri.fsPath);
                const rulesPathAbs = path.resolve(config.rulesFolderPath);
                const relativeFromRoot = path.relative(workspaceRootAbs, rulesPathAbs);

                const isInsideWorkspace = relativeFromRoot !== '' &&
                    !relativeFromRoot.startsWith('..') &&
                    !path.isAbsolute(relativeFromRoot);

                if (!isInsideWorkspace) {
                    errors.push('Rules folder path must be inside the workspace');
                } else {
                    const depth = relativeFromRoot.split(path.sep).filter(Boolean).length;
                    if (depth < 1) {
                        errors.push('Rules folder path must not be the workspace root; choose a subfolder');
                    }
                }
            } catch {
                // ignore resolution errors here; downstream operations will surface them
            }
        }

        return errors;
    }

    /**
     * Produce a checklist of mandatory configuration steps that are still
     * missing.  The result can be surfaced to the user in a settings UI or
     * an information message.
     */
    public getRequiredConfigurationSteps(): { setting: string; description: string; current: string }[] {
        const config = this.getConfig();
        const steps = [];

        if (!config.repoUrl.trim()) {
            steps.push({
                setting: 'aiRulesSyncer.repoUrl',
                description: 'Git repository URL containing your AI rules',
                current: config.repoUrl || '(not configured)'
            });
        }

        return steps;
    }

    /**
     * Ensure that default values (currently only `cacheDirPath`) are written
     * to the user settings when they are not already set.
     */
    public async ensureDefaults(): Promise<void> {
        const config = vscode.workspace.getConfiguration('aiRulesSyncer');

        // Set cache directory default if not configured
        if (!config.get<string>('cacheDirPath')) {
            const defaultCacheDir = this.getDefaultCacheDir();
            await config.update('cacheDirPath', defaultCacheDir, vscode.ConfigurationTarget.Global);
        }
    }

    /**
     * Persist the detected Git default branch at the *user* scope if the
     * user has not yet set a branch explicitly.
     *
     * @param actualBranch The branch detected from the repository.
     * @param logger       Optional VS Code {@link vscode.LogOutputChannel}
     *                     used for informational messages.
     */
    public async setBranchDefault(actualBranch: string, logger?: vscode.LogOutputChannel): Promise<void> {
        const config = vscode.workspace.getConfiguration('aiRulesSyncer');

        // Check if branch has actual values (not just undefined vs empty)
        const workspaceConfig = config.inspect<string>('branch');
        const userBranchValue = workspaceConfig?.globalValue || '';
        const workspaceBranchValue = workspaceConfig?.workspaceValue || '';

        // Set branch default at user level if user level is empty and we have the actual branch
        if (!userBranchValue.trim() && actualBranch) {
            await config.update('branch', actualBranch, vscode.ConfigurationTarget.Global);
            logger?.info(`Auto-configured branch setting at user level to: ${actualBranch}`);
            if (workspaceBranchValue.trim()) {
                logger?.info(`Note: Workspace branch '${workspaceBranchValue}' will override user default`);
            }
        }
    }

    /**
     * Compute the *effective* configuration after defaults have been applied
     * and return it in a presentation-friendly structure.
     */
    public getEffectiveConfiguration(): { setting: string; value: string; isDefault: boolean }[] {
        const rawConfig = vscode.workspace.getConfiguration('aiRulesSyncer');
        const computedConfig = this.getConfig();

        return [
            {
                setting: 'rulesFolderPath',
                value: computedConfig.rulesFolderPath,
                isDefault: !rawConfig.inspect<string>('rulesFolderPath')?.workspaceValue
            },
            {
                setting: 'cacheDirPath',
                value: computedConfig.cacheDirPath,
                isDefault: !rawConfig.get<string>('cacheDirPath', '')
            },
            {
                setting: 'branch',
                value: computedConfig.branch || '(uses repository default)',
                isDefault: !rawConfig.get<string>('branch', '')
            }
        ];
    }
}