/**
 * Unit tests for the ConfigManager class.
 * Tests configuration validation, URL parsing, and error handling
 * for various configuration scenarios.
 */
import assert from 'assert';
import { describe, it, beforeEach } from 'node:test';
import { ConfigManager } from '../configManager';

describe('ConfigManager', () => {
    let configManager: ConfigManager;

    beforeEach(() => {
        configManager = new ConfigManager();
    });

    describe('validateConfig', () => {
        it('should return errors for missing repo URL', () => {
            const config = {
                repoUrl: '',
                teamNames: [],
                rulesFolderPath: '/test/path',
                cacheDirPath: '/cache/path',
                syncIntervalMinutes: 0,
                branch: ''
            };

            const errors = configManager.validateConfig(config);
            assert.strictEqual(errors.length, 1);
            assert(errors[0]?.includes('Repository URL is required'));
        });

        it('should return errors for invalid repo URL', () => {
            const config = {
                repoUrl: 'invalid-url',
                teamNames: [],
                rulesFolderPath: '/test/path',
                cacheDirPath: '/cache/path',
                syncIntervalMinutes: 0,
                branch: ''
            };

            const errors = configManager.validateConfig(config);
            assert.strictEqual(errors.length, 1);
            assert(errors[0]?.includes('valid HTTPS or SSH URL'));
        });

        it('should return errors for negative sync interval', () => {
            const config = {
                repoUrl: 'https://github.com/example/repo.git',
                teamNames: [],
                rulesFolderPath: '/test/path',
                cacheDirPath: '/cache/path',
                syncIntervalMinutes: -1,
                branch: ''
            };

            const errors = configManager.validateConfig(config);
            assert.strictEqual(errors.length, 1);
            assert(errors[0]?.includes('Sync interval must be zero or positive'));
        });

        it('should validate correct HTTPS URL', () => {
            const config = {
                repoUrl: 'https://github.com/example/repo.git',
                teamNames: ['team1'],
                rulesFolderPath: '/test/path',
                cacheDirPath: '/cache/path',
                syncIntervalMinutes: 60,
                branch: 'main'
            };

            const errors = configManager.validateConfig(config);
            assert.strictEqual(errors.length, 0);
        });

        it('should validate correct SSH URL', () => {
            const config = {
                repoUrl: 'git@github.com:example/repo.git',
                teamNames: ['team1', 'team2'],
                rulesFolderPath: '/test/path',
                cacheDirPath: '/cache/path',
                syncIntervalMinutes: 0,
                branch: ''
            };

            const errors = configManager.validateConfig(config);
            assert.strictEqual(errors.length, 0);
        });
    });
});