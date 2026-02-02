#!/bin/bash

# Health check script for GBFM API
# Usage: ./health.sh [-v|--verbose]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

VERBOSE=false
[[ "$1" == "-v" || "$1" == "--verbose" ]] && VERBOSE=true

header "Health Check: ${GBFM_API_URL}/health"

api_get "/health"

print_response "$VERBOSE"

separator

# Exit with appropriate code
if [[ "$API_STATUS" -eq 200 ]]; then
    echo -e "${GREEN}✓ API is healthy${NC}"
    exit 0
else
    echo -e "${RED}✗ API health check failed${NC}"
    exit 1
fi
