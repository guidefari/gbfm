#!/bin/bash

# Common utilities for GBFM API testing scripts
# Source this file in other scripts: source "$(dirname "$0")/lib/common.sh"

set -e

# Configuration
export GBFM_API_URL="${GBFM_API_URL:-http://localhost:3003}"

# Colors
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export DIM='\033[2m'
export NC='\033[0m'

# Check for jq
check_jq() {
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}Error: jq is required but not installed.${NC}"
        echo "Install with: brew install jq"
        exit 1
    fi
}

# Print a separator line
separator() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Print section header
header() {
    local title="$1"
    separator
    echo -e "${CYAN}$title${NC}"
    separator
}

# Format status code with color
format_status() {
    local code="$1"
    if [[ "$code" -ge 200 ]] && [[ "$code" -lt 300 ]]; then
        echo -e "${GREEN}$code${NC}"
    elif [[ "$code" -ge 300 ]] && [[ "$code" -lt 400 ]]; then
        echo -e "${YELLOW}$code${NC}"
    else
        echo -e "${RED}$code${NC}"
    fi
}

# Core curl wrapper for API requests
# Usage: api_request <method> <endpoint> [curl_opts...]
# Returns: Sets API_STATUS, API_HEADERS, API_BODY global variables
api_request() {
    local method="$1"
    local endpoint="$2"
    shift 2
    local extra_opts=("$@")
    
    local url="${GBFM_API_URL}${endpoint}"
    
    # Create temp files for headers and body
    local header_file=$(mktemp)
    local body_file=$(mktemp)
    
    # Make request
    API_STATUS=$(curl -s -X "$method" \
        -o "$body_file" \
        -w "%{http_code}" \
        -D "$header_file" \
        "${extra_opts[@]}" \
        "$url")
    
    API_HEADERS=$(cat "$header_file")
    API_BODY=$(cat "$body_file")
    
    # Cleanup
    rm -f "$header_file" "$body_file"
    
    export API_STATUS API_HEADERS API_BODY
}

# GET request wrapper
# Usage: api_get <endpoint> [curl_opts...]
api_get() {
    api_request "GET" "$@"
}

# POST request wrapper
# Usage: api_post <endpoint> <json_data> [curl_opts...]
api_post() {
    local endpoint="$1"
    local data="$2"
    shift 2
    api_request "POST" "$endpoint" -H "Content-Type: application/json" -d "$data" "$@"
}

# Format and print JSON body
print_json() {
    local json="$1"
    local max_lines="${2:-50}"
    
    if echo "$json" | jq -e . &>/dev/null; then
        echo "$json" | jq -C '.' | head -n "$max_lines"
        local total_lines=$(echo "$json" | jq '.' | wc -l)
        if [[ "$total_lines" -gt "$max_lines" ]]; then
            echo -e "${DIM}... ($((total_lines - max_lines)) more lines)${NC}"
        fi
    else
        echo "$json" | head -c 2000
    fi
}

# Extract and print key headers
print_headers() {
    local headers="$1"
    local verbose="${2:-false}"
    
    echo -e "${YELLOW}Headers:${NC}"
    if [[ "$verbose" == "true" ]]; then
        echo "$headers" | tail -n +2 | sed 's/^/  /'
    else
        echo "$headers" | grep -iE '^(location|content-type|x-|cache-control|set-cookie):' | sed 's/^/  /' || true
    fi
}

# Parse and display HTML response (for redirect pages)
print_html_meta() {
    local html="$1"
    
    echo -e "${DIM}(HTML response - extracting metadata)${NC}"
    echo ""
    
    # Extract title (macOS compatible)
    local title=$(echo "$html" | sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/p' | head -1)
    if [[ -n "$title" ]]; then
        echo -e "  ${CYAN}title:${NC} $title"
    fi
    
    # Extract og: meta tags (macOS compatible)
    echo "$html" | grep -o '<meta property="og:[^"]*" content="[^"]*"' | while read -r line; do
        local prop=$(echo "$line" | sed 's/.*property="\([^"]*\)".*/\1/')
        local content=$(echo "$line" | sed 's/.*content="\([^"]*\)".*/\1/')
        echo -e "  ${CYAN}$prop:${NC} $content"
    done
    
    # Extract meta refresh redirect (macOS compatible)
    local refresh=$(echo "$html" | sed -n 's/.*url=\([^"]*\)".*/\1/p' | head -1)
    if [[ -n "$refresh" ]]; then
        echo -e "  ${CYAN}redirect-url:${NC} $refresh"
    fi
}

# Print full response with formatting
print_response() {
    local verbose="${1:-false}"
    
    echo -e "${YELLOW}Status:${NC} $(format_status "$API_STATUS")"
    echo ""
    
    print_headers "$API_HEADERS" "$verbose"
    echo ""
    
    echo -e "${YELLOW}Body:${NC}"
    local content_type=$(echo "$API_HEADERS" | grep -i '^content-type:' | head -1)
    
    if echo "$content_type" | grep -qi 'application/json'; then
        print_json "$API_BODY"
    elif echo "$API_BODY" | head -c 100 | grep -q '<'; then
        print_html_meta "$API_BODY"
    else
        echo "$API_BODY" | head -c 2000
    fi
}

# Initialize - check dependencies
check_jq
