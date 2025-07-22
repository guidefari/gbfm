#!/bin/bash

# Delete all node_modules folders recursively from current directory
echo "🔍 Finding node_modules folders..."
find . -name "node_modules" -type d -prune -print

echo ""
echo "🗑️  Deleting node_modules folders..."
find . -name "node_modules" -type d -prune -exec rm -rf {} \;

echo "✅ All node_modules folders have been deleted!"