import { createProcessor } from '@mdx-js/mdx'

import { convertLegacyMdxFragment } from './legacy-mdx.ts'

export interface NormalizeResult {
  readonly source: string
  readonly changed: boolean
  readonly unresolved: ReadonlyArray<{ readonly source: string; readonly reason: string }>
}

const componentNames = [
  'Track',
  'Album',
  'Playlist',
  'MusicEntity',
  'YoutubeEmbed',
  'ExternalMedia',
  'Tracklist',
  'HorizontalScrollCards',
] as const

type MdxNode = {
  readonly type: string
  readonly name?: string
  readonly children?: ReadonlyArray<MdxNode>
  readonly position?: {
    readonly start: { readonly offset?: number }
    readonly end: { readonly offset?: number }
  }
}

const processor = createProcessor()

const candidates = (
  source: string,
): ReadonlyArray<{ start: number; end: number; value: string }> => {
  const found: Array<{ start: number; end: number; value: string }> = []

  const visit = (node: MdxNode): void => {
    if (node.type === 'mdxJsxFlowElement' && componentNames.some((name) => name === node.name)) {
      const start = node.position?.start.offset
      const end = node.position?.end.offset

      if (start !== undefined && end !== undefined)
        found.push({ start, end, value: source.slice(start, end) })

      return
    }

    for (const child of node.children ?? []) visit(child)
  }

  // SAFETY: createProcessor.parse returns mdast/MDX nodes; the traversal reads only common
  // positional, name, type, and children fields before the fragment converter parses each match.
  // oxlint-disable-next-line typescript/consistent-type-assertions, typescript/no-unsafe-type-assertion, anti-slop/require-safety-comment-for-type-assertion
  visit(processor.parse(source) as MdxNode)

  return found.sort((left, right) => left.start - right.start)
}

export const normalizeRichContent = (source: string): NormalizeResult => {
  const unresolved: Array<{ source: string; reason: string }> = []
  let output = ''
  let cursor = 0
  let legacyCandidates: ReturnType<typeof candidates>

  try {
    legacyCandidates = candidates(source)
  } catch {
    return {
      source,
      changed: false,
      unresolved: [{ source, reason: 'Document could not be parsed as legacy MDX' }],
    }
  }

  for (const candidate of legacyCandidates) {
    const conversion = convertLegacyMdxFragment(candidate.value)
    output += source.slice(cursor, candidate.start)

    if ('reason' in conversion) {
      output += candidate.value
      unresolved.push({ source: candidate.value, reason: conversion.reason })
    } else output += conversion.canonical
    cursor = candidate.end
  }

  output += source.slice(cursor)

  return { source: output, changed: output !== source, unresolved }
}
