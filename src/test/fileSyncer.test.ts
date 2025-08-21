import assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileSyncer } from '../fileSyncer';
import { RulesConfig } from '../configManager';

// Minimal logger implementing the methods used by FileSyncer
const createTestLogger = () => ({
    info: (_: string) => { },
    warn: (_: string) => { },
    debug: (_: string) => { },
    error: (_: string) => { }
} as any);

async function ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
}

async function writeFile(filePath: string, content: string) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
}

async function exists(p: string) {
    try {
        await fs.stat(p);
        return true;
    } catch {
        return false;
    }
}

describe('FileSyncer', () => {
    const tmpRoot = path.join(os.tmpdir(), `ai-rules-syncer-test-${Date.now()}`);
    let repoPath: string;
    let destPath: string;

    beforeEach(async () => {
        repoPath = path.join(tmpRoot, 'repo');
        destPath = path.join(tmpRoot, 'dest');
        await ensureDir(repoPath);

        // Create general folder and file
        await writeFile(path.join(repoPath, 'general', 'tone.mdc'), 'tone');

        // Create team structure
        await writeFile(path.join(repoPath, 'team', 'cloud-infra', 'general.mdc'), 'cloud');
        await writeFile(path.join(repoPath, 'team', 'blue-team', 'general.mdc'), 'blue');

        // Create teams structure (alternate prefix)
        await writeFile(path.join(repoPath, 'teams', 'cloud-infra', 'extra.mdc'), 'cloud-extra');
        await writeFile(path.join(repoPath, 'teams', 'data-science', 'general.mdc'), 'ds');
    });

    afterEach(async () => {
        // Cleanup tmp root
        try { await fs.rm(tmpRoot, { recursive: true, force: true }); } catch { }
    });

    it('copies only configured team subfolders from any top-level folder starting with "team" and mirrors other folders fully', async () => {
        const logger = createTestLogger();
        const syncer = new FileSyncer(logger);

        const config: RulesConfig = {
            repoUrl: 'https://example/repo.git',
            teamNames: ['cloud-infra'],
            rulesFolderPath: destPath,
            cacheDirPath: path.join(tmpRoot, 'cache'),
            syncIntervalMinutes: 0,
            branch: ''
        };

        await syncer.syncFiles(repoPath, config);

        // general should be copied fully
        assert.strictEqual(await exists(path.join(destPath, 'general', 'tone.mdc')), true);

        // team prefix: only configured subfolder
        assert.strictEqual(await exists(path.join(destPath, 'team', 'cloud-infra', 'general.mdc')), true);
        assert.strictEqual(await exists(path.join(destPath, 'team', 'blue-team', 'general.mdc')), false);

        // teams prefix: only configured subfolder
        assert.strictEqual(await exists(path.join(destPath, 'teams', 'cloud-infra', 'extra.mdc')), true);
        assert.strictEqual(await exists(path.join(destPath, 'teams', 'data-science', 'general.mdc')), false);
    });
});


