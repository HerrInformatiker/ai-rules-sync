/**
 * File synchronization service for AI rules.
 * Handles copying rule files from Git repository to workspace rules folder,
 * replacing the entire contents of the local rules folder on each sync.
 * Copy logic:
 *   1. Iterate top-level entries in repo. For every directory that is not hidden (name starts with '.'): 
 *        • If the directory name starts with 'team' (e.g., 'team', 'teams'), copy only configured team sub-folders under that directory.
 *        • Otherwise copy the directory recursively in full (all file types).
 *   2. Top-level files (non-directories) are ignored for now (not expected).
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { RulesConfig } from './configManager';
import * as vscode from 'vscode';

export class FileSyncer {
    constructor(private logger: vscode.LogOutputChannel) { }

    public async syncFiles(repoPath: string, config: RulesConfig): Promise<void> {
        this.logger.info(`Starting file sync from ${repoPath} to ${config.rulesFolderPath}`);

        // Remove any existing destination directory entirely, then recreate it
        await this.removeDestination(config.rulesFolderPath);
        await fs.mkdir(config.rulesFolderPath, { recursive: true });

        // Copy files from repository
        await this.copyRulesFromRepo(repoPath, config);

        this.logger.info('File sync completed');
    }

    public async hasExistingContent(repoPath: string): Promise<boolean> {
        try {
            const stats = await fs.stat(repoPath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    private async removeDestination(rulesPath: string): Promise<void> {
        this.logger.debug('Removing destination directory entirely');

        try {
            // Remove the entire rules folder (if it exists)
            await fs.rm(rulesPath, { recursive: true, force: true });
            this.logger.debug('Destination directory removed');
        } catch (error) {
            if ((error as any).code !== 'ENOENT') {
                this.logger.warn(`Failed to remove destination directory: ${error}`);
            }
        }
    }

    private async copyRulesFromRepo(repoPath: string, config: RulesConfig): Promise<void> {
        const repoEntries = await fs.readdir(repoPath, { withFileTypes: true });

        for (const entry of repoEntries) {
            // Skip hidden entries ('.git', '.github', etc.) or non-directories
            if (entry.name.startsWith('.') || !entry.isDirectory()) {
                continue;
            }

            const sourcePath = path.join(repoPath, entry.name);

            // Handle any top-level directory whose name starts with 'team' specially
            if (entry.name.startsWith('team')) {
                // Ensure destination team-root folder exists (mirrors source name: 'team', 'teams', etc.)
                const teamDestRoot = path.join(config.rulesFolderPath, entry.name);
                await fs.mkdir(teamDestRoot, { recursive: true });

                for (const teamName of config.teamNames) {
                    const srcTeamPath = path.join(sourcePath, teamName);
                    if (await this.directoryExists(srcTeamPath)) {
                        const destTeamPath = path.join(teamDestRoot, teamName);
                        await this.copyRecursive(srcTeamPath, destTeamPath);
                        this.logger.info(`Copied team rules for: ${teamName} from ${entry.name}/`);
                    } else {
                        this.logger.info(`Team folder not found under ${entry.name}/: ${teamName} (skipping)`);
                    }
                }
            } else {
                // Copy any other top-level directory in full
                const destPath = path.join(config.rulesFolderPath, entry.name);
                await this.copyRecursive(sourcePath, destPath);
                this.logger.info(`Copied folder: ${entry.name}`);
            }
        }
    }

    // Removed granular file copy logic; full directory trees are copied via fs.cp

    // No longer filtering by file extension – copy everything
    private async copyRecursive(src: string, dest: string): Promise<void> {
        await fs.cp(src, dest, { recursive: true, force: true });
    }

    private async directoryExists(dirPath: string): Promise<boolean> {
        try {
            const stats = await fs.stat(dirPath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }
}