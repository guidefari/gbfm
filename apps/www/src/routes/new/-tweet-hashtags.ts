const TAG_CHAR = String.raw`[\w&-]`
const HASHTAG_GLOBAL = new RegExp(`#(${TAG_CHAR}+)`, 'g')
const TRAILING_FRAGMENT = new RegExp(`(^|\\s)#(${TAG_CHAR}*)$`)
const HASHTAG_STRIP = new RegExp(`(^|\\s)#${TAG_CHAR}*`, 'g')

export const TWEET_MAX_LENGTH = 255

export type ActiveField = 'tweet' | 'commentary'

export interface HashtagSuggestion {
  label: string
  isNew: boolean
}

export interface HashtagFragment {
  query: string
  start: number
}

export function extractHashtags(...fields: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const field of fields) {
    for (const match of field.matchAll(HASHTAG_GLOBAL)) {
      const tag = match[1].toLowerCase()
      if (!seen.has(tag)) {
        seen.add(tag)
        result.push(tag)
      }
    }
  }
  return result
}

export function stripHashtags(text: string): string {
  return text
    .replace(HASHTAG_STRIP, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function activeFragment(text: string, caret: number): HashtagFragment | null {
  const upToCaret = text.slice(0, caret)
  const match = TRAILING_FRAGMENT.exec(upToCaret)
  if (!match) return null
  return {
    query: match[2].toLowerCase(),
    start: match.index + match[1].length
  }
}

const TYPED_SUGGESTION_LIMIT = 5
const BROWSE_SUGGESTION_LIMIT = 30

export function suggestHashtags(
  query: string,
  knownTags: readonly string[],
  selected: readonly string[]
): HashtagSuggestion[] {
  const pool = knownTags.map(toTagToken)
  const taken = new Set(selected.map((tag) => tag.toLowerCase()))
  const limit = query ? TYPED_SUGGESTION_LIMIT : BROWSE_SUGGESTION_LIMIT
  const matches = pool
    .filter((tag) => tag.startsWith(query) && !taken.has(tag))
    .slice(0, limit)
    .map((label) => ({ label, isNew: false }))

  if (query && !pool.includes(query) && !taken.has(query)) {
    matches.push({ label: query, isNew: true })
  }
  return matches
}

export function completeFragment(text: string, fragment: HashtagFragment, tag: string): string {
  return `${text.slice(0, fragment.start)}#${tag} `
}

export function appendHashtag(text: string, tag: string): string {
  const trimmed = text.replace(/\s*$/, '')
  const separator = trimmed ? ' ' : ''
  return `${trimmed}${separator}#${tag} `
}

export function removeHashtag(text: string, tag: string): string {
  const escaped = tag.replace(/[&-]/g, '\\$&')
  const pattern = new RegExp(`(^|\\s)#${escaped}(?!${TAG_CHAR})`, 'gi')
  return text
    .replace(pattern, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function toTagToken(tag: string): string {
  return tag.replace(/\s+/g, '-').toLowerCase()
}
