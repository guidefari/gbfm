import { apiGet, colors, header, parseArgs, printResponse, separator, API_URL } from './lib/common'

const { GREEN, RED } = colors

const { verbose, help } = parseArgs(Bun.argv.slice(2))

if (help) {
  console.log(`Usage: bun run scripts/api-test/health.ts [-v|--verbose]

Check API health status.

Options:
  -v, --verbose     Show all response headers
  -h, --help        Show this help message

Environment:
  GBFM_API_URL      Base URL (default: http://127.0.0.1:3003)`)
  process.exit(0)
}

header(`Health Check: ${API_URL}/health`)

const response = await apiGet('/health')

printResponse(response, verbose)

separator()

if (response.status === 200) {
  console.log(`${GREEN}✓ API is healthy${colors.NC}`)
  process.exit(0)
} else {
  console.log(`${RED}✗ API health check failed${colors.NC}`)
  process.exit(1)
}
