#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

print_usage() {
    cat << EOF
Usage: $0 [options]

Options:
  -v, --verbose     Show all response headers
  -h, --help        Show this help message

Environment:
  GBFM_API_URL      Base URL (default: http://localhost:3003)

Examples:
  $0
  $0 -v
EOF
}

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
            echo -e "${RED}Unknown option: $1${NC}"
            print_usage
            exit 1
            ;;
    esac
done

ENDPOINT="/sitemap.xml"

header "Sitemap: ${GBFM_API_URL}${ENDPOINT}"

api_get "$ENDPOINT"

echo -e "${YELLOW}Status:${NC} $(format_status "$API_STATUS")"
echo ""

print_headers "$API_HEADERS" "$VERBOSE"
echo ""

echo -e "${YELLOW}Body:${NC}"

if echo "$API_BODY" | head -c 10 | grep -q '<?xml'; then
    url_count=$(echo "$API_BODY" | grep -c '<url>')
    total_size=$(echo "$API_BODY" | wc -c | tr -d ' ')

    echo -e "  ${CYAN}Total URLs:${NC} $url_count"
    echo -e "  ${CYAN}Size:${NC} ${total_size} bytes"
    echo ""
    echo -e "${DIM}First few URLs:${NC}"
    echo "$API_BODY" | grep '<loc>' | head -10 | sed 's/^/  /'
else
    echo "$API_BODY" | head -c 500
fi

separator

if [[ "$API_STATUS" -eq 200 ]]; then
    echo -e "${GREEN}✓ Sitemap retrieved successfully${NC}"
    exit 0
else
    echo -e "${RED}✗ Sitemap request failed${NC}"
    exit 1
fi
