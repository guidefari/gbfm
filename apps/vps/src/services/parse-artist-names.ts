const SEPARATORS =
  /\s*(?:,\s*|\s+&\s+|\s+and\s+|\s+feat\.?\s+|\s+ft\.?\s+|\s+×\s+|\s+x\s+|\s+vs\.?\s+)\s*/i

export function parseArtistNames(raw: string): string[] {
  return raw
    .split(SEPARATORS)
    .map((s) => s.trim())
    .filter(Boolean)
}
