const RED = "\x1b[0;31m";
const GREEN = "\x1b[0;32m";
const YELLOW = "\x1b[1;33m";
const BLUE = "\x1b[0;34m";
const CYAN = "\x1b[0;36m";
const DIM = "\x1b[2m";
const NC = "\x1b[0m";

export const colors = { RED, GREEN, YELLOW, BLUE, CYAN, DIM, NC };

export const API_URL = process.env.GBFM_API_URL ?? "http://127.0.0.1:3003";

export interface ApiResponse {
  status: number;
  headers: Headers;
  body: string;
}

export async function apiRequest(
  method: string,
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse> {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, { method, ...options });
  const body = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body,
  };
}

export async function apiGet(endpoint: string): Promise<ApiResponse> {
  return apiRequest("GET", endpoint);
}

export async function apiPost(
  endpoint: string,
  data: unknown
): Promise<ApiResponse> {
  return apiRequest("POST", endpoint, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function formatStatus(code: number): string {
  if (code >= 200 && code < 300) {
    return `${GREEN}${code}${NC}`;
  } else if (code >= 300 && code < 400) {
    return `${YELLOW}${code}${NC}`;
  }
  return `${RED}${code}${NC}`;
}

export function separator(): void {
  console.log(
    `${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`
  );
}

export function header(title: string): void {
  separator();
  console.log(`${CYAN}${title}${NC}`);
  separator();
}

export function printJson(json: string, maxLines = 50): void {
  try {
    const parsed = JSON.parse(json);
    const formatted = JSON.stringify(parsed, null, 2);
    const lines = formatted.split("\n");
    console.log(lines.slice(0, maxLines).join("\n"));
    if (lines.length > maxLines) {
      console.log(`${DIM}... (${lines.length - maxLines} more lines)${NC}`);
    }
  } catch {
    console.log(json.slice(0, 2000));
  }
}

export function printHeaders(headers: Headers, verbose = false): void {
  console.log(`${YELLOW}Headers:${NC}`);
  const interestingHeaders = [
    "location",
    "content-type",
    "cache-control",
    "set-cookie",
  ];

  headers.forEach((value, key) => {
    const keyLower = key.toLowerCase();
    if (
      verbose ||
      interestingHeaders.includes(keyLower) ||
      keyLower.startsWith("x-")
    ) {
      console.log(`  ${key}: ${value}`);
    }
  });
}

export function printHtmlMeta(html: string): void {
  console.log(`${DIM}(HTML response - extracting metadata)${NC}`);
  console.log("");

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  if (titleMatch) {
    console.log(`  ${CYAN}title:${NC} ${titleMatch[1]}`);
  }

  const ogMatches = html.matchAll(
    /<meta property="(og:[^"]*)" content="([^"]*)"/gi
  );
  for (const match of ogMatches) {
    console.log(`  ${CYAN}${match[1]}:${NC} ${match[2]}`);
  }

  const refreshMatch = html.match(/url=([^"]*)/i);
  if (refreshMatch) {
    console.log(`  ${CYAN}redirect-url:${NC} ${refreshMatch[1]}`);
  }
}

export function printResponse(response: ApiResponse, verbose = false): void {
  console.log(`${YELLOW}Status:${NC} ${formatStatus(response.status)}`);
  console.log("");

  printHeaders(response.headers, verbose);
  console.log("");

  console.log(`${YELLOW}Body:${NC}`);
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    printJson(response.body);
  } else if (response.body.slice(0, 100).includes("<")) {
    printHtmlMeta(response.body);
  } else {
    console.log(response.body.slice(0, 2000));
  }
}

export function parseArgs(args: string[]): {
  verbose: boolean;
  positional: string[];
  help: boolean;
} {
  const verbose = args.includes("-v") || args.includes("--verbose");
  const help = args.includes("-h") || args.includes("--help");
  const positional = args.filter(
    (a) => !a.startsWith("-") && a !== "-v" && a !== "--verbose"
  );
  return { verbose, positional, help };
}
