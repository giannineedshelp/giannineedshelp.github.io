#!/bin/bash
# GIOAI v2.5 - Deploy worker to Cloudflare
# Usage: CF_TOKEN=your_token ACCOUNT_ID=your_id ./deploy-worker.sh

CF_TOKEN="${CF_TOKEN:-$1}"
ACCOUNT_ID="${ACCOUNT_ID:-$2}"

if [ -z "$CF_TOKEN" ] || [ -z "$ACCOUNT_ID" ]; then
  echo "Usage: CF_TOKEN=your_token ACCOUNT_ID=your_id $0"
  echo ""
  echo "Get these from https://dash.cloudflare.com:"
  echo "  CF_TOKEN    — Create API token with Workers:Edit permission"
  echo "  ACCOUNT_ID  — Found in Workers & Pages URL or overview sidebar"
  exit 1
fi

WORKER_JS="$(cat "$(dirname "$0")/worker.js")"

echo "Deploying worker.js to Cloudflare..."
RESP=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/gioai" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/javascript" \
  --data-binary @<(echo "$WORKER_JS"))

SUCCESS=$(echo "$RESP" | grep -o '"success":true')

if [ -n "$SUCCESS" ]; then
  echo "Success! Worker deployed."
  echo "Then set env vars (GEMINI_KEY, ADMIN_KEY) at:"
  echo "  https://dash.cloudflare.com/${ACCOUNT_ID}/workers-and-pages/workers/gioai/settings/variables"
else
  echo "Failed:"
  echo "$RESP" | grep -o '"message":"[^"]*"' | head -3
  echo ""
  echo "Full response:"
  echo "$RESP"
fi

