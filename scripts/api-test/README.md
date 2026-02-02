# API Test Scripts

Bash scripts for testing GBFM API endpoints.

## Setup

Requires `jq` for JSON formatting:

```bash
brew install jq
```

## Configuration

Set the API base URL (defaults to `http://localhost:3003`):

```bash
export GBFM_API_URL="https://api.example.com"
```

## Scripts

### health.sh

Check API health status.

```bash
./scripts/api-test/health.sh
./scripts/api-test/health.sh -v  # verbose
```

### redirect.sh

Test share/redirect endpoints (`/s/*`).

```bash
./scripts/api-test/redirect.sh mix my-mix-slug
./scripts/api-test/redirect.sh profile guidefari
./scripts/api-test/redirect.sh show some-show
./scripts/api-test/redirect.sh catch-all any-slug -v
```

Supported types: `mix`, `track`, `show`, `profile`, `release`, `label`, `catch-all`

### resolve.sh

Test slug resolution endpoint (`/resolve/:slug`).

```bash
./scripts/api-test/resolve.sh guidefari
./scripts/api-test/resolve.sh some-slug -v
```

## Extending

Add new scripts by sourcing the common library:

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# Use api_get, api_post, print_response, etc.
api_get "/your/endpoint"
print_response
```

### Available Functions

| Function | Description |
|----------|-------------|
| `api_get <endpoint>` | GET request, sets `API_STATUS`, `API_HEADERS`, `API_BODY` |
| `api_post <endpoint> <json>` | POST request with JSON body |
| `api_request <method> <endpoint>` | Generic request |
| `print_response [verbose]` | Format and print the response |
| `print_json <json>` | Pretty-print JSON with jq |
| `header <title>` | Print section header |
| `separator` | Print separator line |
| `format_status <code>` | Color-coded status code |
