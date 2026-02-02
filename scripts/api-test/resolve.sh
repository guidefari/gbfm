#!/bin/bash

# Resolve endpoint testing for GBFM API
# Usage: ./resolve.sh <slug> [-v|--verbose]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

print_usage() {
    cat << EOF
Usage: $0 <slug> [options]

Resolves a slug to determine its entity type (profile, show, etc.)

Options:
  -v, --verbose     Show all response headers

Environment:
  GBFM_API_URL      Base URL (default: http://localhost:3003)

Examples:
  $0 guidefari
  $0 some-show-name -v
EOF
}

# Parse arguments
SLUG=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            if [[ -z "$SLUG" ]]; then
                SLUG="$1"
            fi
            shift
            ;;
    esac
done

if [[ -z "$SLUG" ]]; then
    print_usage
    exit 1
fi

header "Resolve: ${GBFM_API_URL}/resolve/${SLUG}"

api_get "/resolve/$SLUG"

print_response "$VERBOSE"

separator

# Show resolution result summary
if [[ "$API_STATUS" -eq 200 ]]; then
    ENTITY_TYPE=$(echo "$API_BODY" | jq -r '.type // .entityType // "unknown"' 2>/dev/null)
    echo -e "${GREEN}✓ Resolved as: $ENTITY_TYPE${NC}"
elif [[ "$API_STATUS" -eq 404 ]]; then
    echo -e "${YELLOW}⚠ Slug not found${NC}"
else
    echo -e "${RED}✗ Resolution failed${NC}"
fi
