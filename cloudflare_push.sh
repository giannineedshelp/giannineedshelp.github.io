#!/bin/bash
# GIOAI v6.0 - Cloudflare Worker Push Script (Sanitized)

DIR="/sdcard/Documents/gioai"
if [ ! -d "$DIR" ]; then DIR="/storage/shared/Documents/gioai"; fi

if [ ! -f "$DIR/.env" ]; then
    echo "Error: .env not found"
    exit 1
fi

CF_TOKEN=$(grep "CLOUDFLARE_TOKEN=" "$DIR/.env" | cut -d'=' -f2)
export CLOUDFLARE_API_TOKEN="$CF_TOKEN"

if command -v wrangler &> /dev/null; then
    wrangler -c "$DIR/wrangler.toml" deploy "$DIR/worker.js" --name gioai
else
    echo "Wrangler not found. Use CF_TOKEN from .env"
fi
