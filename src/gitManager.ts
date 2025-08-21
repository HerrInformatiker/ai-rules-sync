/**
 * Git repository management service for AI rules.
 * Handles cloning, fetching, and updating Git repositories with proper locking
 * to prevent concurrent operations and ensure data integrity.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { SimpleGit, simpleGit } from 'simple-git';
import { RulesConfig } from './configManager';
import properLockfile from 'proper-lockfile';
import * as vscode from 'vscode';

export class GitManager {
    constructor(private logger: vscode.LogOutputChannel) { }

    public async ensureRepository(config: RulesConfig): Promise<{ repoPath: string; actualBranch?: string }> {
        const repoPath = this.getRepositoryPath(config);

        // Ensure cache directory exists before acquiring lock
        await fs.mkdir(path.dirname(repoPath), { recursive: true });

        // Acquire file lock to prevent concurrent operations
        const release = await this.acquireLock(repoPath);

        try {
            const repoExists = await this.repositoryExists(repoPath);
            let actualBranch: string | undefined;

            if (!repoExists) {
                this.logger.info(`Cloning repository for the first time to ${repoPath}`);
                actualBranch = await this.cloneRepository(config, repoPath);
            } else {
                this.logger.info(`Repository exists, fetching updates`);
                await this.fetchRepository(config, repoPath);

                // Get current branch if we need to update config
                if (!config.branch) {
                    const repoGit = simpleGit(repoPath);
                    actualBranch = (await repoGit.revparse(['--abbrev-ref', 'HEAD'])).trim();
                }
            }

            return { repoPath, actualBranch };
        } finally {
            await this.releaseLock(release);
        }
    }

    public getRepositoryPath(config: RulesConfig): string {
        const repoSlug = this.generateRepoSlug(config.repoUrl);
        return path.join(config.cacheDirPath, repoSlug);
    }

    private async repositoryExists(repoPath: string): Promise<boolean> {
        try {
            const gitDir = path.join(repoPath, '.git');
            const stats = await fs.stat(gitDir);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    private async cloneRepository(config: RulesConfig, repoPath: string): Promise<string> {
        // Cache directory already ensured in ensureRepository

        const git = simpleGit();
        const cloneOptions = ['--depth=1'];

        if (config.branch) {
            cloneOptions.push('--branch', config.branch);
        }

        try {
            await git.clone(config.repoUrl, repoPath, cloneOptions);
            this.logger.info(`Successfully cloned repository to ${repoPath}`);

            // Get the actual branch that was cloned
            const repoGit = simpleGit(repoPath);
            const currentBranch = await repoGit.revparse(['--abbrev-ref', 'HEAD']);

            return currentBranch.trim();
        } catch (error) {
            this.logger.error(`Failed to clone repository`, error);
            throw new Error(`Git clone failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async fetchRepository(config: RulesConfig, repoPath: string): Promise<void> {
        const git = simpleGit(repoPath);

        try {
            // Get current HEAD commit before fetch
            const currentCommit = await git.revparse(['HEAD']);

            // Fetch latest changes
            await git.fetch(['--depth=1']);

            // Get latest commit from the remote branch
            const remoteBranch = config.branch || await this.getDefaultBranch(git);
            const remoteCommit = await git.revparse([`origin/${remoteBranch}`]);

            if (currentCommit !== remoteCommit) {
                this.logger.info(`New commits available, updating from ${currentCommit.substring(0, 8)} to ${remoteCommit.substring(0, 8)}`);

                // Reset to the latest remote commit
                await git.reset(['--hard', `origin/${remoteBranch}`]);
            } else {
                this.logger.info('Repository is already up to date');
            }
        } catch (error) {
            this.logger.error('Failed to fetch repository updates', error);

            // If fetch fails but we have a local copy, continue with offline behavior
            const hasLocalCopy = await this.repositoryExists(repoPath);
            if (hasLocalCopy) {
                this.logger.warn('Using existing cached copy due to fetch failure');
                return;
            }

            throw new Error(`Git fetch failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getDefaultBranch(git: SimpleGit): Promise<string> {
        try {
            // Try symbolic-ref first (most reliable)
            const symbolic = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
            const m = symbolic.trim().match(/refs\/remotes\/origin\/(.+)$/);
            if (m?.[1]) return m[1];
        } catch { }

        try {
            // Try remote show origin
            const remoteShow = await git.raw(['remote', 'show', 'origin']);
            const m = remoteShow.match(/HEAD branch:\s*(.+)/);
            if (m?.[1]) return m[1].trim();
        } catch { }

        try {
            // Fallback to branch listing
            const branchSummary = await git.branch(['-r']);
            if (branchSummary.all.includes('origin/main')) return 'main';
            if (branchSummary.all.includes('origin/master')) return 'master';
        } catch { }

        return 'main';
    }

    private generateRepoSlug(repoUrl: string): string {
        try {
            if (repoUrl.startsWith('http')) {
                const u = new URL(repoUrl);
                const parts = u.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
                const org = parts.at(-2) ?? 'repo';
                const repo = parts.at(-1) ?? 'unknown';
                return `${org}-${repo}`.replace(/[^a-zA-Z0-9-_]/g, '-');
            }

            // Handle SSH URLs like git@github.com:org/repo.git
            const m = repoUrl.match(/^[\w.-]+@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/);
            if (m) {
                return `${m[1]}-${m[2]}`.replace(/[^a-zA-Z0-9-_]/g, '-');
            }
        } catch { }

        // Fallback to base64url encoding for safety
        return Buffer.from(repoUrl).toString('base64url').slice(0, 32);
    }

    private async acquireLock(lockTargetPath: string): Promise<() => Promise<void>> {
        await fs.mkdir(path.dirname(lockTargetPath), { recursive: true });
        try {
            return await properLockfile.lock(lockTargetPath, {
                retries: { retries: 10, minTimeout: 3000, maxTimeout: 3000 },
                realpath: false
            });
        } catch (e: any) {
            throw new Error(`Failed to acquire lock: ${e?.message ?? String(e)}`);
        }
    }

    private async releaseLock(release?: () => Promise<void>): Promise<void> {
        try {
            if (release) await release();
        } catch (e: any) {
            this.logger.warn(`Failed to release lock: ${e?.message ?? e}`);
        }
    }

    public dispose(): void {
        // No cleanup needed with proper-lockfile
    }
}