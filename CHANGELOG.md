# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [0.0.6] - 2025-08-21

### Fixed
- README: Typos

## [0.0.5] - 2025-08-20

### Changed
- Added dark `galleryBanner` to `package.json` for a dark-themed Marketplace header.

## [0.0.4] - 2025-08-14

### Added
- VS Code Marketplace badges in README.
- Publish script `publish:vsce` using `VSCE_PAT`.

## [0.0.3] - 2025-08-13

### Fixed
- README: Minor typos.

## [0.0.2] - 2025-08-12
### Added
- CHANGELOG with release notes.

### Changed
- README: Troubleshooting aligned with actual code behavior.
  - First-time failure modal now documented (Retry / Work with local copy).
  - Clarified offline behavior and logging to "AI Rules Syncer" output channel.
  - Added validation notes for `rulesFolderPath` and `syncIntervalMinutes`.
  - Documented immediate re-sync on settings change (no reload required).
- INSTALLATION: Updated troubleshooting to remove reload advice; added offline/cached-rules behavior.

## [0.0.1] - 2025-08-01
### Added
- Initial release with automatic sync, team-specific copying, periodic sync, offline support, and commands.


