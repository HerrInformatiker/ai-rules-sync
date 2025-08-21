# Installation and Setup Guide

## Prerequisites

- VS Code 1.99.0 or higher
- Node.js 18.x or higher
- Git (for repository access)
- Access to your AI rules repository

## Development Setup

1. **Clone and Install Dependencies**
   ```bash
   git clone <this-repo>
   cd cursor-rules-extension
   npm install
   ```

2. **Compile TypeScript**
   ```bash
   npm run compile
   ```

3. **Run Tests**
   ```bash
   node test-integration.js
   ```

## Installing the Extension

### Method 1: Development Mode

1. Open VS Code
2. Open this project folder
3. Press `F5` to launch the Extension Development Host
4. A new VS Code window will open with the extension loaded

### Method 2: Package and Install

1. **Install VSCE (VS Code Extension Manager)**
   ```bash
   npm install -g vsce
   ```

2. **Package the Extension**
   ```bash
   vsce package
   ```

3. **Install the Extension**
   ```bash
   code --install-extension ai-rules-syncer.vsix
   ```

## Configuration

### Method 1: Automatic Setup (Recommended)

1. **Install the extension** - it will automatically prompt you on first use
2. **Click "Configure Now"** when the setup dialog appears
3. **Enter your repository URL** in the input box that appears
4. **Wait for initial sync** to complete

### Method 2: Command Palette

1. **Open Command Palette** (`Ctrl/Cmd + Shift + P`)
2. **Run**: "AI Rules Syncer: Configure AI Rules"
3. **Follow the prompts** to enter your repository URL

### Method 3: Manual Settings

1. **Open VS Code Settings** (`Ctrl/Cmd + ,`)
2. **Search for**: "ai-rules-syncer"
3. **Configure Required Settings**
   ```json
   {
     "aiRulesSyncer.repoUrl": "git@github.com:YourOrg/ai-coding-rules.git"
   }
   ```

4. **Configure Optional Settings**
   ```json
   {
     "aiRulesSyncer.teamNames": ["cloud-infra"],
  "aiRulesSyncer.syncIntervalMinutes": 60
   }
   ```

## Repository Setup

1. **Create Your Rules Repository** using the structure in `sample-rules-repo/`

2. **Add Your Rule Files** (all files within each rule folder are synchronized)

3. **Ensure Git Access** - the extension supports both SSH and HTTPS

## Testing the Extension

1. **Check Output Logs**
   - Open Command Palette (`Ctrl/Cmd + Shift + P`)
   - Run: "View: Toggle Output"
   - Select "AI Rules Syncer" from the dropdown

2. **Manual Sync**
   - Open Command Palette
   - Run: "AI Rules Syncer: Refresh Rules"

3. **Verify File Sync**
   - Check that files appear in `.cursor/rules/remote/` in your workspace
   - Verify team-specific folders are created if configured
   - ⚠️  Anything inside `.cursor/rules/remote/` will be deleted and replaced on each sync; keep personal files elsewhere

## Troubleshooting

### Common Issues

1. **Git Authentication Errors**
   - Ensure SSH keys are set up for SSH URLs
   - For HTTPS, ensure you have appropriate credentials

2. **Permission Errors**
   - Check that VS Code has write permissions to the workspace
   - Verify the cache directory is writable

3. **Configuration Issues**
   - Changes to `aiRulesSyncer.*` settings take effect immediately; no window reload is required
   - Check the "AI Rules Syncer" output channel for detailed logs

4. **Offline or Git Errors**
   - On first-time failures you'll be prompted to **Retry** or **Work with local copy**
   - Choosing "Work with local copy" uses the cached rules if available; otherwise you'll be warned that no rules exist yet
   - Subsequent network failures show a non-blocking warning and continue with cached rules



### Manual Testing

Use the integration test script:
```bash
node test-integration.js
```

## Next Steps

1. **Customize for Your Organization**
   - Update package.json with your organization details
   - Modify configuration defaults as needed
   - Add organization-specific validation

2. **Publishing**
   - Set up CI/CD for automated testing
   - Publish to VS Code Marketplace
   - Set up update notifications

3. **Advanced Features**
   - Add rule preview functionality
   - Implement telemetry (optional)
   - Add support for rule templates