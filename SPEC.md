# AI Rules Syncer – Implementation Specification

## Purpose  
Keep each developer's local rules folder synchronized with a central Git repository that stores company-wide rule files, while honoring optional team-specific subsets.

## Repository Structure Example
The ai-coding-rules repository follows a similar structure:

```
ai-coding-rules/
├── general/
│   └── tone.mdc
├── language/
│   ├── docker.mdc
│   └── nodejs.mdc
├── role/
│   ├── architect.mdc
│   └── security-expert.mdc
├── README.md
└── team/
    └── cloud-infra/
        └── general.mdc
    └── blue-team/
        └── general.mdc    
```

**Folder Usage:**
- `/general` - Company-wide rules that always apply, regardless of team
- `/language` - Language-specific rules (e.g., nodejs, golang) applied via globs to relevant file extensions
- `/role` - AI roles that can be assumed (e.g., system architect, security expert) - applied manually by users
- `/team` - Team-specific rules (e.g., algorithm, cloud-infra) - always applied for that team

---

## A. User-Configurable Settings  
1. **repoUrl** (string, **required**)  
   • SSH example `git@github.com:Org/ai-coding-rules.git`  
   • HTTPS example `https://github.com/Org/ai-coding-rules.git`  
   • Protocol is inferred directly from the URL.

2. **teamNames** (string | string[]) – zero, one, or many team folders to pull  
   • VS Code UI presents as array type for better UX  
   • JSON configuration accepts both string (comma-separated) and array formats  
   • Code automatically normalizes string input to array  
   &nbsp;&nbsp;_e.g._ `"cloud-infra"` or `["cloud-infra","blue-team"]`

3. **rulesFolderPath** (string, default computed as `<workspace>/.cursor/rules/remote`) – destination inside the current project.  
   • VS Code setting shows empty string as default for better UX  
   • Extension computes actual default when empty string provided

4. **cacheDirPath** (string) – shared clone location, defaults by OS  
   • Linux `~/.cache/`  
   • macOS `~/Library/Caches/`  
   • Windows `%LOCALAPPDATA%/ai-coding-rules` (resolved at runtime)

5. **syncIntervalMinutes** (number, default **0**) – 0 ＝ no timer; otherwise run periodic sync at this minute interval.

6. **branch** (string, optional) – specific git branch to track; defaults to repository's default branch.

---

## B. Startup / Synchronisation Flow  
1. Acquire file-lock on `cacheDirPath/<repoSlug>` to avoid concurrent fetches. Retry after timeout if another process holds the lock.  

2. **Clone / Fetch**  
   • First run → `git clone --depth=1 <repoUrl> <cacheDirPath>/<repoSlug>`  
   • Later runs → `git fetch --depth=1`, then compare new `HEAD` with last-synced commit.

3. **Git failure handling**  
   *Blocking modal* shows error plus buttons: **Retry** / **Work with local copy**  
   • **Retry** loops step 2.  
   • **Work with local copy** continues with last cloned content.  
   • If no local copy exists → close modal and raise non-blocking notification:  
     "No rules available; working without rules".

---

## C. Copying Rules into Workspace  
1. **Pre-clean** – delete **all** content inside `rulesFolderPath`.

2. **Copy from cached repo**  
   • For each `teamName` copy `/team/<teamName>/**` (log info level if folder missing).  
   • Copy **all other top-level folders** (`general`, `language`, `role`, and any future ones) recursively, mirroring the repo.  
   • Copy **all** files and subfolders.

3. Remove any files in destination that were deleted upstream. Never touch folders not present in the repo (e.g. `project` or personal).

4. **User edit warning**  
   • All files under `rulesFolderPath` may be overwritten or deleted during sync. Store any personal or project-specific files outside this folder.

---

## D. Manual & Periodic Sync  
• Command Palette: **"AI Rules: Refresh Rules"** (primary sync command)  
• Additional commands available:  
  - **"AI Rules: Configure AI Rules"** – Opens configuration wizard  
  - **"AI Rules: Open AI Rules Settings"** – Direct settings access  
  - **"AI Rules: Show Current Configuration"** – Display current config  
• If `syncIntervalMinutes > 0`, start repeating timer that invokes full sync logic.

---

## E. Error-Handling & UI  
• Blocking modal only on first-time clone failure.  
• **Enhanced user interactions:**  
  - Configuration validation with detailed error messages  
  - Automatic configuration wizard for first-time setup  
  - Repository URL validation with user-friendly prompts  
  - Graceful fallback with user choice (Retry vs Work with Local Copy)  
• **Configuration change handling:**  
  - Automatic re-sync when repo URL, teams, branch, or paths change  
  - Timer updates when sync interval changes  
  - Real-time validation prevents invalid configurations  
• Cursor notifications for warnings (network issues, missing team folder, etc.).  
• Dedicated **Output** channel named **"AI Rules Syncer"** for info / warn / debug logs.

---

## F. Performance  
• Shallow clone (`--depth=1`) stored once in `cacheDirPath/<repoSlug>`; reused by all workspaces.  
• **Repository slug generation**: Deterministic naming based on URL parsing ensures consistent cache locations  
• Full folder replacement on each sync of `rulesFolderPath` to ensure exact mirroring of the repository state.  
• **File locking**: Prevents concurrent Git operations using proper-lockfile with retry logic  

Note: Incremental copy (rsync-style or checksum-skip) may be considered as a future optimization.

---

## G. Security  
• Allow both SSH and HTTPS; optionally allow-list hostnames via settings.  
• Copies entire repository content (non-hidden folders) including all file types.  
• _(Optional)_ Warn if latest commit is unsigned.

---

## H. Offline Behaviour  
If `git fetch` fails after at least one successful clone, keep existing cached rules, log a warning, and proceed.

---

## I. OS Support  
Linux, macOS, and Windows 11 (or newer).

---

## J. Out-of-Scope for MVP (record for future work)  
* Show Effective Rules preview command  
* Telemetry of sync success / failure

---

## K. Repository Slug Generation
Cache directory names are generated from repository URLs using the following algorithm:
• **HTTPS URLs**: Extract org/repo from pathname, format as `{org}-{repo}`  
• **SSH URLs**: Parse `user@host:org/repo.git` format, extract org/repo  
• **Fallback**: Base64url encoding (truncated to 32 chars) for safety  
• All slugs sanitized to contain only alphanumeric chars, hyphens, and underscores  

Examples:
• `https://github.com/Org/ai-coding-rules.git` → `Org-ai-coding-rules`  
• `git@github.com:Org/ai-coding-rules.git` → `Org-ai-coding-rules`  
• `https://custom.git.server/path/to/repo.git` → `path-repo`  

---

## L. Configuration Change Behavior
• Immediate resync on changes to: `repoUrl`, `teamNames`, `branch`, `rulesFolderPath`, and `cacheDirPath`.  
• `syncIntervalMinutes` updates the timer only; the next sync occurs on the next scheduled tick.