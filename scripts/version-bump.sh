#!/bin/bash

set -e

echo "🔍 Analyzing commits for version bump..."

LATEST_TAG=$(git tag --sort=-version:refname | head -1 || echo "v0.0.0")
echo "📌 Latest tag: $LATEST_TAG"

CURRENT_PACKAGE_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current package.json version: $CURRENT_PACKAGE_VERSION"

TAG_VERSION=$(echo "$LATEST_TAG" | sed 's/^v//')
if [ "$CURRENT_PACKAGE_VERSION" != "$TAG_VERSION" ]; then
    echo "🔄 Syncing package.json version with latest tag..."
    bun pm version $TAG_VERSION --no-git-tag-version
    echo "✅ Package.json version synced to $TAG_VERSION"
fi

COMMITS_SINCE_TAG=$(git log --oneline --no-merges "$LATEST_TAG..HEAD" 2>/dev/null | grep -v "^[a-f0-9]\{7\} v[0-9]" || true)

if [ -z "$COMMITS_SINCE_TAG" ]; then
    echo "✅ No new commits since last tag, skipping version bump"
    exit 0
fi

echo "📝 Commits since $LATEST_TAG:"
echo "$COMMITS_SINCE_TAG"

MAJOR_COUNT=0
MINOR_COUNT=0
PATCH_COUNT=0

while IFS= read -r commit; do
    if [[ $commit =~ ^[a-f0-9]{7}\ (feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: ]]; then
        prefix=$(echo "$commit" | sed -E 's/^[a-f0-9]{7} (feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert).*/\1/')
        
        case $prefix in
            "feat")
                MINOR_COUNT=$((MINOR_COUNT + 1))
                echo "  🚀 Found feature commit: $commit"
                ;;
            "fix")
                PATCH_COUNT=$((PATCH_COUNT + 1))
                echo "  🐛 Found fix commit: $commit"
                ;;
            "docs"|"style"|"refactor"|"perf"|"test"|"build"|"ci"|"chore"|"revert")
                PATCH_COUNT=$((PATCH_COUNT + 1))
                echo "  🔧 Found $prefix commit: $commit"
                ;;
        esac
    elif [[ $commit =~ ^[a-f0-9]{7}\ (BREAKING\ CHANGE|!:) ]]; then
        MAJOR_COUNT=$((MAJOR_COUNT + 1))
        echo "  💥 Found breaking change: $commit"
    fi
done <<< "$COMMITS_SINCE_TAG"

echo ""
echo "📊 Version bump analysis:"
echo "  Major changes: $MAJOR_COUNT"
echo "  Minor changes: $MINOR_COUNT"
echo "  Patch changes: $PATCH_COUNT"

CURRENT_VERSION=$(echo "$LATEST_TAG" | sed 's/^v//')
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

NEW_MAJOR=$MAJOR
NEW_MINOR=$MINOR
NEW_PATCH=$PATCH

if [ $MAJOR_COUNT -gt 0 ]; then
    NEW_MAJOR=$((MAJOR + 1))
    NEW_MINOR=0
    NEW_PATCH=0
    echo "🚀 Bumping major version"
    VERSION_TYPE="major"
elif [ $MINOR_COUNT -gt 0 ]; then
    NEW_MINOR=$((MINOR + 1))
    NEW_PATCH=0
    echo "✨ Bumping minor version"
    VERSION_TYPE="minor"
elif [ $PATCH_COUNT -gt 0 ]; then
    NEW_PATCH=$((PATCH + 1))
    echo "🔧 Bumping patch version"
    VERSION_TYPE="patch"
else
    echo "✅ No version bump needed"
    exit 0
fi

NEW_VERSION="v$NEW_MAJOR.$NEW_MINOR.$NEW_PATCH"
echo "🏷️  New version: $NEW_VERSION"

echo ""
echo "📦 Updating package.json version..."
bun pm version $VERSION_TYPE --no-git-tag-version

echo "📦 Creating new tag: $NEW_VERSION"
git tag "$NEW_VERSION"

echo "📝 Committing version bump..."
git add .
git commit -m "chore: bump version to $NEW_VERSION" --no-verify

echo "✅ Version bump complete! New tag: $NEW_VERSION"
echo "💡 Remember to push your changes: git push origin prod --tags" 
# post commit test