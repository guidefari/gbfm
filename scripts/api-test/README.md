# API Test Scripts

TypeScript scripts for testing GBFM API endpoints, run with Bun.

## Configuration

Set the API base URL (defaults to `http://127.0.0.1:3003`):

```bash
export GBFM_API_URL="https://api.example.com"
```

## Scripts

### health.ts

Check API health status.

```bash
bun run scripts/api-test/health.ts
bun run scripts/api-test/health.ts -v  # verbose
```

### redirect.ts

Test share/redirect endpoints (`/s/*`).

```bash
bun run scripts/api-test/redirect.ts mix my-mix-slug
bun run scripts/api-test/redirect.ts profile guidefari
bun run scripts/api-test/redirect.ts show some-show
bun run scripts/api-test/redirect.ts catch-all any-slug -v
```

Supported types: `mix`, `track`, `show`, `profile`, `release`, `label`, `catch-all`

### resolve.ts

Test slug resolution endpoint (`/resolve/:slug`).

```bash
bun run scripts/api-test/resolve.ts guidefari
bun run scripts/api-test/resolve.ts some-slug -v
```

### sitemap.ts

Test sitemap endpoint (`/sitemap.xml`).

```bash
bun run scripts/api-test/sitemap.ts
bun run scripts/api-test/sitemap.ts -v
```

## Extending

Add new scripts by importing from the common library:

```typescript
import { apiGet, colors, header, parseArgs, printResponse, separator, API_URL } from './lib/common'

const { verbose } = parseArgs(Bun.argv.slice(2))

header(`My Endpoint: ${API_URL}/your/endpoint`)

const response = await apiGet('/your/endpoint')

printResponse(response, verbose)

separator()
```

### Available Functions

| Function                                | Description                        |
| --------------------------------------- | ---------------------------------- |
| `apiGet(endpoint)`                      | GET request, returns `ApiResponse` |
| `apiPost(endpoint, data)`               | POST request with JSON body        |
| `apiRequest(method, endpoint, options)` | Generic request                    |
| `printResponse(response, verbose)`      | Format and print the response      |
| `printJson(json, maxLines)`             | Pretty-print JSON                  |
| `header(title)`                         | Print section header               |
| `separator()`                           | Print separator line               |
| `formatStatus(code)`                    | Color-coded status code            |
| `parseArgs(args)`                       | Parse CLI arguments                |
