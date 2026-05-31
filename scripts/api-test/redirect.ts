import { apiGet, colors, header, parseArgs, printResponse, separator, API_URL } from './lib/common'

const { RED, NC } = colors

const USAGE = `Usage: bun run scripts/api-test/redirect.ts <type> <slug> [options]

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
  -h, --help        Show this help message

Environment:
  GBFM_API_URL      Base URL (default: http://127.0.0.1:3003)

Examples:
  bun run scripts/api-test/redirect.ts mix my-awesome-mix
  bun run scripts/api-test/redirect.ts profile guidefari -v
  bun run scripts/api-test/redirect.ts catch-all some-slug`

const { verbose, positional, help } = parseArgs(Bun.argv.slice(2))

if (help) {
  console.log(USAGE)
  process.exit(0)
}

const [type, slug] = positional

if (!type || !slug) {
  console.log(USAGE)
  process.exit(1)
}

const endpointMap: Record<string, string> = {
  mix: `/s/mix/${slug}`,
  track: `/s/track/${slug}`,
  show: `/s/show/${slug}`,
  profile: `/s/profile/${slug}`,
  release: `/s/release/${slug}`,
  label: `/s/label/${slug}`,
  'catch-all': `/s/${slug}`
}

const endpoint = endpointMap[type]

if (!endpoint) {
  console.log(`${RED}Unknown type: ${type}${NC}`)
  console.log(USAGE)
  process.exit(1)
}

header(`Redirect: ${API_URL}${endpoint}`)

const response = await apiGet(endpoint)

printResponse(response, verbose)

separator()
