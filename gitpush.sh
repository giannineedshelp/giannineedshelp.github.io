#!/bin/bash
# GIOAI Git Push Helper
# Usage: bash gitpush.sh <your_github_token>
# Get token: GitHub -> Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens
# Needed permissions: Contents (read/write)

GIT_DIR="$(dirname "$0")/.git"
GIT_WORK_TREE="$(dirname "$0")"

# Add all changes
GIT_DIR="$GIT_DIR" GIT_WORK_TREE="$GIT_WORK_TREE" git add -A

# Commit
GIT_DIR="$GIT_DIR" GIT_WORK_TREE="$GIT_WORK_TREE" git commit -m "Update $(date +%Y-%m-%d_%H:%M)"

if [ -n "$1" ]; then
    # Use token if provided
    GIT_DIR="$GIT_DIR" GIT_WORK_TREE="$GIT_WORK_TREE" git push "https://$1@github.com/giannineedshelp/GIOAI.github.io.git" main
else
    echo ""
    echo "No token provided. To push, run:"
    echo "  bash gitpush.sh YOUR_GITHUB_TOKEN"
    echo ""
    echo "Or manually:"
    echo "  cd $(dirname "$0")"
    echo "  git add -A && git commit -m \"update\" && git push"
    echo ""
    echo "To create a token:"
    echo "  1. Go to https://github.com/settings/tokens"
    echo "  2. Generate new token (classic) with 'repo' scope"
    echo "  3. Run: bash gitpush.sh YOUR_TOKEN"
fi

