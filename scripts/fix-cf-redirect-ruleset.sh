#!/usr/bin/env bash
# Fix: Delete orphaned Cloudflare http_request_dynamic_redirect zone ruleset
#
# Context: Cloudflare only allows ONE zone-level ruleset per phase.
# If SST/Pulumi state gets out of sync with Cloudflare (e.g. after a partial
# deployment failure), the next deploy will fail with error 20217 because it
# tries to POST (create) a ruleset that already exists.
#
# This script deletes the orphaned zone ruleset so SST can recreate and
# track it properly on the next deployment.
#
# Usage:
#   CLOUDFLARE_API_TOKEN=<token> ZONE_ID=<zone_id> ./scripts/fix-cf-redirect-ruleset.sh
#
# The zone ID for goosebumps.fm is in the deployment error output.
# The API token must have Zone > Rulesets > Edit permission.

set -euo pipefail

ZONE_ID="${ZONE_ID:-75566badee03001f5a62414d8c32901d}"
API_TOKEN="${CLOUDFLARE_API_TOKEN:?'CLOUDFLARE_API_TOKEN env var is required'}"
PHASE="http_request_dynamic_redirect"

echo "Fetching rulesets for zone $ZONE_ID..."

RULESETS=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json")

echo "$RULESETS" | python3 -m json.tool --no-ensure-ascii 2>/dev/null || echo "$RULESETS"

# Find the zone-level ruleset for the target phase
RULESET_ID=$(echo "$RULESETS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('result', []):
    if r.get('phase') == '${PHASE}' and r.get('kind') == 'zone':
        print(r['id'])
        break
" 2>/dev/null || true)

if [ -z "$RULESET_ID" ]; then
  echo ""
  echo "No zone-level ruleset found for phase '${PHASE}'."
  echo "The deployment error may have a different cause."
  exit 0
fi

echo ""
echo "Found orphaned ruleset: $RULESET_ID"
echo "Phase: $PHASE"
echo ""
echo "Deleting ruleset $RULESET_ID ..."

DELETE_RESP=$(curl -s -X DELETE \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/${RULESET_ID}" \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json")

echo "$DELETE_RESP" | python3 -m json.tool --no-ensure-ascii 2>/dev/null || echo "$DELETE_RESP"

SUCCESS=$(echo "$DELETE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "false")

if [ "$SUCCESS" = "True" ]; then
  echo ""
  echo "Ruleset deleted successfully."
  echo "You can now redeploy with: bun deploy:prod"
else
  echo ""
  echo "Delete may have failed. Check the response above."
  exit 1
fi
