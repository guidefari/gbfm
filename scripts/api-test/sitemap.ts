import {
  apiGet,
  colors,
  formatStatus,
  header,
  parseArgs,
  printHeaders,
  separator,
  API_URL
} from './lib/common'

const { GREEN, RED, CYAN, DIM, YELLOW, NC } = colors

const USAGE = `Usage: bun run scripts/api-test/sitemap.ts [options]

Options:
  -v, --verbose     Show all response headers
  -h, --help        Show this help message

Environment:
  GBFM_API_URL      Base URL (default: http://127.0.0.1:3003)

Examples:
  bun run scripts/api-test/sitemap.ts
  bun run scripts/api-test/sitemap.ts -v`

const { verbose, help } = parseArgs(Bun.argv.slice(2))

if (help) {
  console.log(USAGE)
  process.exit(0)
}

const endpoint = '/sitemap.xml'

header(`Sitemap: ${API_URL}${endpoint}`)

const response = await apiGet(endpoint)

console.log(`${YELLOW}Status:${NC} ${formatStatus(response.status)}`)
console.log('')

printHeaders(response.headers, verbose)
console.log('')

console.log(`${YELLOW}Body:${NC}`)

if (response.body.slice(0, 10).includes('<?xml')) {
  const urlMatches = response.body.match(/<url>/g)
  const urlCount = urlMatches?.length ?? 0
  const totalSize = response.body.length

  console.log(`  ${CYAN}Total URLs:${NC} ${urlCount}`)
  console.log(`  ${CYAN}Size:${NC} ${totalSize} bytes`)
  console.log('')
  console.log(`${DIM}First few URLs:${NC}`)

  const locMatches = response.body.match(/<loc>[^<]+<\/loc>/g)
  if (locMatches) {
    locMatches.slice(0, 10).forEach((loc) => {
      console.log(`  ${loc}`)
    })
  }
} else {
  console.log(response.body.slice(0, 500))
}

separator()

if (response.status === 200) {
  console.log(`${GREEN}✓ Sitemap retrieved successfully${NC}`)
  process.exit(0)
} else {
  console.log(`${RED}✗ Sitemap request failed${NC}`)
  process.exit(1)
}
