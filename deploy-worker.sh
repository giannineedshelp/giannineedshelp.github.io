#!/bin/bash
# GIOAI v3.0 - Deploy worker to Cloudflare
# Usage: ./deploy-worker.sh [CF_TOKEN] [ACCOUNT_ID]

CF_TOKEN="${1:-cfat_jLnDArR8VdUa1nKDOYm57JRDKZPRwnrVjHtiNNv1c11b48a7}"
ACCOUNT_ID="${2:-0ba0f8827332ddbfd23dc6bfeb46c7c3}"

WORKER_JS="$(cat "$(dirname "$0")/worker.js")"

echo "Deploying worker.js to Cloudflare..."
RESP=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/gioai" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/javascript" \
  --data-binary @<(echo "$WORKER_JS"))

if echo "$RESP" | grep -q '"success":true'; then
  echo "Success! Worker deployed."
  echo ""
  echo "=== NEXT: Set Environment Variables ==="
  echo "Go to https://dash.cloudflare.com/${ACCOUNT_ID}/workers-and-pages/workers/gioai/settings/variables"
  echo "Add these env vars:"
  echo "  GEMINI_KEY  (secret) - Your Google Gemini API key"
  echo "  GROQ_KEY    (secret) - Your Groq API key (mixtral-8x7b-32768)"
  echo "  MISTRAL_KEY (secret) - Your Mistral API key (mistral-large-latest)"
  echo "  ADMIN_KEY   (plain)  - Admin panel password (default: gioai-default-admin-key)"
else
  echo "Failed:"
  echo "$RESP" | grep -o '"message":"[^"]*"' | head -3
  echo ""
  echo "Manual deploy: paste worker.js content into Cloudflare Dashboard"
fi

