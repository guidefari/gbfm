#!/bin/bash

# Fresh install script - removes all dependencies and reinstalls them
echo "🔍 Finding node_modules folders..."
find . -name "node_modules" -type d -prune -print

echo ""
echo "🗑️  Deleting node_modules folders..."
find . -name "node_modules" -type d -prune -exec rm -rf {} \;

echo ""
echo "🧹 Cleaning lock files..."
rm -f package-lock.json yarn.lock pnpm-lock.yaml bun.lockb

echo ""
echo "📦 Installing dependencies with bun..."
bun install

echo ""
echo "🚀 Installing SST dependencies..."
bun sst install

echo ""
echo "✅ Fresh install complete!"