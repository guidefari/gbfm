import { createProcessor } from '@mdx-js/mdx'

import { convertLegacyMdxFragment } from './legacy-mdx.ts'
import { parseRichContent } from './source.ts'

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
  'iframe',
  'div',
  'hr',
  'br',
] as const

type MdxNode = {
  readonly type: string
  readonly name?: string
  readonly value?: string
  readonly children?: ReadonlyArray<MdxNode>
  readonly position?: {
    readonly start: { readonly offset?: number }
    readonly end: { readonly offset?: number }
  }
}

const processor = createProcessor()

const canonicalDirective = /(?:^|\n)\s*:::{0,1}[a-z][\w-]*(?:\{|\s|$)/

const candidates = (
  source: string,
): ReadonlyArray<{ start: number; end: number; value: string; inline: boolean }> => {
  const found: Array<{ start: number; end: number; value: string; inline: boolean }> = []

  const visit = (node: MdxNode): void => {
    if (node.type === 'html' && node.value?.trimStart().startsWith('<iframe')) {
      const start = node.position?.start.offset
      const end = node.position?.end.offset

      if (start !== undefined && end !== undefined)
        found.push({ start, end, value: source.slice(start, end), inline: false })

      return
    }

    if (
      (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
      componentNames.some((name) => name === node.name)
    ) {
      const start = node.position?.start.offset
      const end = node.position?.end.offset

      if (start !== undefined && end !== undefined)
        found.push({
          start,
          end,
          value: source.slice(start, end),
          inline: node.type === 'mdxJsxTextElement',
        })

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
  if (canonicalDirective.test(source) && parseRichContent(source).diagnostics.length === 0)
    return { source, changed: false, unresolved: [] }

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
    } else
      output +=
        candidate.inline && conversion.component === 'iframe'
          ? `\n\n${conversion.canonical}\n\n`
          : conversion.canonical
    cursor = candidate.end
  }

  output += source.slice(cursor)

  return { source: output, changed: output !== source, unresolved }
}
