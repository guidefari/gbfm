import {
  apiGet,
  colors,
  header,
  parseArgs,
  printResponse,
  separator,
  API_URL,
} from "./lib/common";

const { GREEN, YELLOW, RED, NC } = colors;

const USAGE = `Usage: bun run scripts/api-test/resolve.ts <slug> [options]

Resolves a slug to determine its entity type (profile, show, etc.)

Options:
  -v, --verbose     Show all response headers
  -h, --help        Show this help message

Environment:
  GBFM_API_URL      Base URL (default: http://127.0.0.1:3003)

Examples:
  bun run scripts/api-test/resolve.ts guidefari
  bun run scripts/api-test/resolve.ts some-show-name -v`;

const { verbose, positional, help } = parseArgs(Bun.argv.slice(2));

if (help) {
  console.log(USAGE);
  process.exit(0);
}

const [slug] = positional;

if (!slug) {
  console.log(USAGE);
  process.exit(1);
}

header(`Resolve: ${API_URL}/resolve/${slug}`);

const response = await apiGet(`/resolve/${slug}`);

printResponse(response, verbose);

separator();

if (response.status === 200) {
  try {
    const data = JSON.parse(response.body);
    const entityType = data.type ?? data.entityType ?? "unknown";
    console.log(`${GREEN}✓ Resolved as: ${entityType}${NC}`);
  } catch {
    console.log(`${GREEN}✓ Resolved${NC}`);
  }
} else if (response.status === 404) {
  console.log(`${YELLOW}⚠ Slug not found${NC}`);
} else {
  console.log(`${RED}✗ Resolution failed${NC}`);
}
