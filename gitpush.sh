#!/bin/bash
# GIOAI v6.0 - Auto Git Push Script (Sanitized)
# Keys are loaded from .env which is in .gitignore

DIR="/sdcard/Documents/gioai"
if [ ! -d "$DIR" ]; then DIR="/storage/shared/Documents/gioai"; fi

if [ ! -f "$DIR/.env" ]; then
    echo "Error: .env not found"
    exit 1
fi

# Extract token from .env
GH_TOKEN=$(grep "GITHUB_TOKEN=" "$DIR/.env" | cut -d'=' -f2)

if [ -z "$GH_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN not found in .env"
    exit 1
fi

git -C "$DIR" config user.name "giannineedshelp"
git -C "$DIR" config user.email "gianni.kei@gmail.com"
git -C "$DIR" remote set-url origin "https://giannineedshelp:${GH_TOKEN}@github.com/giannineedshelp/giannineedshelp.github.io.git"

git -C "$DIR" add .
git -C "$DIR" commit -m "Update v6.0: Consolidated LanguageNut & UI fixes (Clean)"
git -C "$DIR" push origin main --force
