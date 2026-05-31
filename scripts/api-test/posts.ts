import { apiGet, colors, header, parseArgs, printResponse, separator, API_URL } from './lib/common'

const { GREEN, RED, CYAN, NC } = colors

const { verbose, help } = parseArgs(Bun.argv.slice(2))

if (help) {
  console.log(`Usage: bun run scripts/api-test/posts.ts [-v|--verbose]

Test paginated posts endpoint.

Options:
  -v, --verbose     Show all response headers
  -h, --help        Show this help message

Environment:
  GBFM_API_URL      Base URL (default: http://127.0.0.1:3003)`)
  process.exit(0)
}

function printPaginationSummary(body: string) {
  try {
    const parsed = JSON.parse(body)
    const count = parsed.data?.length ?? 0
    const total = parsed.pagination?.total ?? '?'
    const hasMore = parsed.pagination?.hasMore ?? '?'
    console.log(`\n${CYAN}Results: ${count} items, total: ${total}, hasMore: ${hasMore}${NC}`)
  } catch {
    console.log(`${RED}✗ Failed to parse response${NC}`)
  }
}

async function testGetPosts() {
  header(`GET ${API_URL}/content/posts (default - all types)`)
  const res1 = await apiGet('/content/posts')
  printResponse(res1, verbose)
  if (res1.status === 200) {
    printPaginationSummary(res1.body)
    console.log(`${GREEN}✓ Default pagination works${NC}`)
  } else {
    console.log(`\n${RED}✗ Default pagination failed${NC}`)
  }

  separator()

  header(`GET ${API_URL}/content/posts?type=post`)
  const res2 = await apiGet('/content/posts?type=post')
  printResponse(res2, verbose)
  if (res2.status === 200) {
    printPaginationSummary(res2.body)
    console.log(`${GREEN}✓ Filter by type=post works${NC}`)
  } else {
    console.log(`\n${RED}✗ Filter by type=post failed${NC}`)
  }

  separator()

  header(`GET ${API_URL}/content/posts?type=micro`)
  const res3 = await apiGet('/content/posts?type=micro')
  printResponse(res3, verbose)
  if (res3.status === 200) {
    printPaginationSummary(res3.body)
    console.log(`${GREEN}✓ Filter by type=micro works${NC}`)
  } else {
    console.log(`\n${RED}✗ Filter by type=micro failed${NC}`)
  }

  separator()

  header(`GET ${API_URL}/content/posts?type=post&limit=5&offset=0`)
  const res4 = await apiGet('/content/posts?type=post&limit=5&offset=0')
  printResponse(res4, verbose)
  if (res4.status === 200) {
    printPaginationSummary(res4.body)
    console.log(`${GREEN}✓ Type filter with pagination works${NC}`)
  } else {
    console.log(`\n${RED}✗ Type filter with pagination failed${NC}`)
  }

  separator()
}

await testGetPosts()
