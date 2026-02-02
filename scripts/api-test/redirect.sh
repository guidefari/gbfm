#!/bin/bash

# Redirect endpoint testing for GBFM API
# Usage: ./redirect.sh <type> <slug> [-v|--verbose]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

print_usage() {
    cat << EOF
Usage: $0 <type> <slug> [options]

Types:
  mix <slug>        Test /s/mix/:slug
  track <slug>      Test /s/track/:slug
  show <slug>       Test /s/show/:slug
  profile <user>    Test /s/profile/:username
  release <slug>    Test /s/release/:slug
  label <slug>      Test /s/label/:slug
  catch-all <slug>  Test /s/:slug (generic resolver)

Options:
  -v, --verbose     Show all response headers

Environment:
  GBFM_API_URL      Base URL (default: http://localhost:3003)

Examples:
  $0 mix my-awesome-mix
  $0 profile guidefari -v
  $0 catch-all some-slug
EOF
}

# Parse arguments
TYPE=""
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
            if [[ -z "$TYPE" ]]; then
                TYPE="$1"
            elif [[ -z "$SLUG" ]]; then
                SLUG="$1"
            fi
            shift
            ;;
    esac
done

if [[ -z "$TYPE" ]] || [[ -z "$SLUG" ]]; then
    print_usage
    exit 1
fi

# Map type to endpoint
case $TYPE in
    mix)        ENDPOINT="/s/mix/$SLUG" ;;
    track)      ENDPOINT="/s/track/$SLUG" ;;
    show)       ENDPOINT="/s/show/$SLUG" ;;
    profile)    ENDPOINT="/s/profile/$SLUG" ;;
    release)    ENDPOINT="/s/release/$SLUG" ;;
    label)      ENDPOINT="/s/label/$SLUG" ;;
    catch-all)  ENDPOINT="/s/$SLUG" ;;
    *)
        echo -e "${RED}Unknown type: $TYPE${NC}"
        print_usage
        exit 1
        ;;
esac

header "Redirect: ${GBFM_API_URL}${ENDPOINT}"

api_get "$ENDPOINT"

print_response "$VERBOSE"

separator
