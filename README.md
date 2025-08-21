# AI Rules Syncer Extension

[![VS Code Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/HerrInformatiker.ai-rules-syncer)](https://marketplace.visualstudio.com/items?itemName=HerrInformatiker.ai-rules-syncer)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Sponsor](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86)](https://github.com/sponsors/HerrInformatiker)

Automatically synchronizes AI rules from a central Git repository to your local workspace, ensuring consistent AI behavior.

## Features

- **Automatic Synchronization on Startup**
- **Flexible Rules Repository Layout**: Maintains your rules repository's structure
- **Offline Support**: Works with cached rules when the rules repository is unavailable
- **Periodic Sync**: Optional automatic synchronization at configurable intervals
- **Secure**: Supports both SSH and HTTPS Git authentication

## Quick Start

1. **Install the extension**
2. **Configure your repository**: The extension will prompt you on first use
   - Enter your AI rules repository URL when prompted. Both HTTPS and SSH formats are supported:
     - HTTPS: `https://github.com/YourOrg/my-ai-rules.git`
     - SSH: `git@github.com:YourOrg/my-ai-rules.git`
   - Or use the command palette: "AI Rules Syncer: Configure AI Rules"
3. **Start coding** with synchronized AI rules!

## Configuration

You can configure or update the extension settings at any time by using:

- **Command Palette**: Run "AI Rules Syncer: Configure AI Rules"
- **Settings Panel**: Open VS Code Settings and search for `ai-rules-syncer`

### Settings Reference

| Setting Name | Required | Description | Default |
|--------------|----------|-------------|---------|
| `aiRulesSyncer.repoUrl` | **Yes** | Git repository URL (SSH or HTTPS)<br/>Examples:<br/>• `git@github.com:YourOrg/my-ai-rules.git`<br/>• `https://github.com/YourOrg/my-ai-rules.git` | *(empty - you'll be prompted)* |
| `aiRulesSyncer.teamNames` | No | Team folder name(s) to include from `team/`.<br/>If set, only those subfolders under `team/` are copied (e.g. `team/cloud-infra`).<br/>If empty/omitted, no `team/` subfolders are copied.<br/>Examples:<br/>• Single team: `"cloud-infra"`<br/>• Multiple teams: `["cloud-infra", "blue-team"]` | None |
| `aiRulesSyncer.rulesFolderPath` | No | Destination folder for rules | `.cursor/rules/remote` |
| `aiRulesSyncer.cacheDirPath` | No | Cache directory for storing repository data | Linux: `~/.cache`<br/>macOS: `~/Library/Caches`<br/>Windows: `%LOCALAPPDATA%/ai-coding-rules`<br/>Other: `~/.ai-coding-rules-cache` |
| `aiRulesSyncer.syncIntervalMinutes` | No | Auto-sync interval in minutes (0 = disabled) | 0 |
| `aiRulesSyncer.branch` | No | Specific Git branch to track | Repository default |  
  
⚠️ **Warning**: On each sync, the extension deletes everything inside the `rulesFolderPath` (`.cursor/rules/remote` by default) and replaces it with the mirrored content from your repository as explained in [How your remote AI rules are copied](#how-your-remote-ai-rules-are-copied). **Keep any personal files outside this folder.**


## How your remote AI rules are copied

For example, if your AI rules remote repo structure is as follows, and you set `teamNames = ["cloud-infra"]` and the rules folder to `./.cursor/rules/remote/`:
```
my-ai-rules/
├── .git/                   # hidden — not copied
├── README.md               # top-level file — not copied
├── general/                # copied recursively
│   ├── tone.mdc
│   └── subdir/
│       └── extra.mdc
├── language/               # copied recursively
│   ├── docker.mdc
│   └── nodejs.mdc
├── role/                   # copied recursively
│   ├── architect.mdc
│   └── security-expert.mdc
└── team/
    ├── cloud-infra/        # copied recursively (matches configured team)
    │   └── general.mdc
    └── data-science/       # not copied (not in configured teams)
        └── general.mdc
```

Which results in the following `<workspace>/.cursor/rules/remote/`:
```
<workspace>/.cursor/rules/remote/
├── general/                # copied recursively
│   ├── tone.mdc
│   └── subdir/
│       └── extra.mdc
├── language/               # copied recursively
│   ├── docker.mdc
│   └── nodejs.mdc
├── role/                   # copied recursively
│   ├── architect.mdc
│   └── security-expert.mdc
└── team/
    └── cloud-infra/        # only configured team subfolder(s) are copied
        └── general.mdc
```

### How copying works
- **Pre-clean**: Deletes everything inside `rulesFolderPath` on each sync.
- **All top-level folders (except `team/`)**: Copied entirely, recursively.
- **`team/` folder**: Only subfolders matching your configured `teamNames` are copied (e.g., `team/cloud-infra`, `team/blue-team`). Others are skipped.
- **Hidden entries**: Folders starting with `.` (e.g., `.git`, `.github`) and top-level files are ignored.
- **Everything inside copied folders**: All files and subfolders are included.

## Commands

Access these commands through the Command Palette (`Ctrl/Cmd + Shift + P`):

- **AI Rules Syncer: Configure AI Rules** - Run the configuration wizard
- **AI Rules Syncer: Refresh Rules** - Manually trigger synchronization
- **AI Rules Syncer: Open AI Rules Settings** - Open the settings panel
- **AI Rules Syncer: Show Current Configuration** - Display the current configuration (repo URL, team names, paths)

## Offline Behavior

If the repository is unavailable:
- On first run: A blocking modal appears with options: **Retry** or **Work with local copy**
  - Retry attempts the sync operation again
  - Work with local copy uses the last cached rules if available; otherwise you will be warned that no rules are available
- On subsequent runs: A non-blocking warning is shown and the extension continues with cached rules when possible
- All details are logged in the "AI Rules Syncer" output channel

## Troubleshooting

### Configuration Issues
- **Not Configured**: Run "AI Rules Syncer: Configure AI Rules" from Command Palette
- **Invalid Repository URL**: Ensure URL is a valid Git repository (SSH or HTTPS)
- **Access Denied**: Verify your Git credentials and repository permissions
- **Rules folder path invalid**: The rules folder must be inside the current workspace and not be the workspace root. Adjust `aiRulesSyncer.rulesFolderPath` (default is `.cursor/rules/remote`).
- **Sync interval invalid**: `aiRulesSyncer.syncIntervalMinutes` must be zero or positive.

### Sync Issues
1. **Check the Output Channel**: View "AI Rules Syncer" output for detailed logs
2. **Verify Git Access**: Test repository access using `git clone <your-url>` in terminal
3. **Manual Sync**: Use "Refresh Rules" command to test synchronization
4. **Team-specific content**: If some team folders are missing, verify `aiRulesSyncer.teamNames`. Missing team folders are skipped and logged at info level.
5. **Config changes apply live**: Changing any `aiRulesSyncer.*` setting triggers an immediate re-sync; no window reload is required.
6. **Reset Configuration**: Clear or update settings via "Open AI Rules Settings" or re-run the configuration command.

### Common Error Messages
- **"Repository not found"**: Check if the repository URL is correct and accessible
- **"Authentication failed"**: Verify your Git credentials (SSH keys or token)
- **"No workspace folder"**: Open a workspace folder before using the extension
- **"Rules folder path must be inside the workspace" / "must not be the workspace root"**: Adjust `aiRulesSyncer.rulesFolderPath` to a subfolder within your workspace
- **"Git clone failed: ..."**: Check repository URL, credentials, and network; try again or choose "Work with local copy"
- **"Git fetch failed: ..."**: Network issues or access changes; the extension will use the cached copy if available
- **"Failed to acquire lock: ..."**: Another VS Code window or process is syncing the same repo cache. Wait a moment or close the other instance and retry.

## Requirements

- VS Code 1.99.0 or higher
- Git (for repository access)
- Network access to your rules repository