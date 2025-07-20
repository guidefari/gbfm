# Scripts

This directory contains utility scripts for the project.

## version-bump.sh

Automatically bumps the project version based on conventional commit messages since the last git tag.

### Features

- **Conventional Commit Analysis**: Analyzes commits since the last tag for conventional commit prefixes
- **Automatic Version Bumping**: 
  - `feat:` → Minor version bump
  - `fix:` → Patch version bump  
  - `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `chore:`, `revert:` → Patch version bump
  - `BREAKING CHANGE` → Major version bump
- **Package.json Sync**: Ensures package.json version matches the latest git tag
- **Git Tag Management**: Creates and pushes new version tags

### Usage

The script is automatically executed by the git pre-push hook, but can also be run manually:

```bash
./scripts/version-bump.sh
```

### Requirements

- Git repository with conventional commit messages
- Bun package manager
- Node.js (for reading package.json)

### How it works

1. Gets the latest git tag
2. Syncs package.json version with the latest tag if out of sync
3. Analyzes commits since the last tag for conventional commit prefixes
4. Determines the next version based on commit types
5. Updates package.json using `bun pm version --no-git-tag-version`
6. Creates and pushes a new git tag

## Git Hook Setup

To enable automatic version bumping on push, you need to set up the git pre-push hook.

### Option 1: Manual Setup

Create or update `.git/hooks/pre-push` with the following content:

```bash
#!/bin/bash

set -e

# Get the repository root directory
REPO_ROOT=$(git rev-parse --show-toplevel)

# Execute the version-controlled script
exec "$REPO_ROOT/scripts/version-bump.sh"
```

Then make it executable:

```bash
chmod +x .git/hooks/pre-push
```

### Option 2: Copy from Repository

If the hook is already set up in the repository, you can copy it:

```bash
cp .git/hooks/pre-push.sample .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

### Option 3: Using Git Config

You can also set up the hook using git config (if you have a hooks directory in your repository):

```bash
git config core.hooksPath .git/hooks
```

### Verification

To verify the hook is working, try pushing to your repository. You should see output like:

```
🔍 Analyzing commits for version bump...
📌 Latest tag: v1.0.0
📦 Current package.json version: 1.0.0
📝 Commits since v1.0.0:
abc1234 feat: add new feature
def5678 fix: resolve bug
  🚀 Found feature commit: abc1234 feat: add new feature
  🐛 Found fix commit: def5678 fix: resolve bug

📊 Version bump analysis:
  Major changes: 0
  Minor changes: 1
  Patch changes: 1
✨ Bumping minor version
🏷️  New version: v1.1.0

📦 Updating package.json version...
📦 Creating new tag: v1.1.0
📤 Pushing tag to remote...
✅ Version bump complete! New tag: v1.1.0
```

### Troubleshooting

- **Hook not running**: Make sure the file is executable (`chmod +x .git/hooks/pre-push`)
- **Script not found**: Ensure the repository root is correctly detected
- **Permission denied**: Check that the script file is executable (`chmod +x scripts/version-bump.sh`) 