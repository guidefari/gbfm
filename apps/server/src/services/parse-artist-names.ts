const SEPARATORS = /\s*(?:,\s*|\s+feat\.?\s+|\s+ft\.?\s+)\s*/i

export function parseArtistNames(raw: string): Array<string> {
  return raw
    .split(SEPARATORS)
    .map((s) => s.trim())
    .filter(Boolean)
}
