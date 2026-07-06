import { makeHealthAssertions, runHealthAssertion } from '@gbfm/api-test/health'
import { API_URL, colors, header, parseArgs, printResponse, separator } from './lib/common'

const { DIM, GREEN, RED } = colors

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

let healthy = true

for (const assertion of makeHealthAssertions(API_URL)) {
  header(assertion.name)
  console.log(`${DIM}${assertion.curl}${colors.NC}`)
  console.log('')

  try {
    const result = await runHealthAssertion(assertion, { baseUrl: API_URL })
    printResponse(
      {
        status: result.status,
        headers: result.headers,
        body: result.bodyText
      },
      verbose
    )
    console.log('')
    console.log(`${GREEN}✓ Assertion passed${colors.NC}`)
  } catch (error) {
    healthy = false
    console.log(`${RED}✗ Assertion failed${colors.NC}`)
    console.log(error instanceof Error ? error.message : String(error))
  }

  separator()
}

process.exit(healthy ? 0 : 1)
