import { Effect, Option } from 'effect'
import {
  parsePendingMusicEntityEffect,
  transformPastedEditorialContentEffect,
  type PendingMusicEntity
} from './editorial-paste'
import type { MusicEntityResolution } from './editorial-music-resolution'
import { serializeMusicEntity } from '@/components/editor/music-entity/music-entity-markdown'

export type EditorialMusicDocumentChange = {
  readonly from: number
  readonly to: number
  readonly insert: string
}

export type EditorialMusicSelection = {
  readonly from: number
  readonly to: number
}

export type EditorialMusicLifecycleSettlement = {
  readonly changes: ReadonlyArray<{
    readonly from: number
    readonly to: number
    readonly insert: string
  }>
  readonly failureCount: number
}

export type EditorialMusicPaste = {
  readonly content: string
  readonly commit: () => Promise<EditorialMusicLifecycleSettlement>
}

type TrackedPendingEntity = PendingMusicEntity & {
  from: number
  to: number
  readonly expected: string
  valid: boolean
}

type ResolutionOperation = {
  readonly entities: ReadonlyArray<TrackedPendingEntity>
  active: boolean
}

type EditorialMusicLifecycleOptions = {
  readonly resolve: (urls: ReadonlyArray<string>) => Promise<ReadonlyArray<MusicEntityResolution>>
}

export type EditorialMusicLifecycle = {
  readonly initialize: (document: string) => void
  readonly pendingCount: (document: string) => number
  readonly preparePaste: (input: {
    readonly document: string
    readonly selections: ReadonlyArray<EditorialMusicSelection>
    readonly text: string
  }) => EditorialMusicPaste | null
  readonly update: (document: string, changes: ReadonlyArray<EditorialMusicDocumentChange>) => void
  readonly dispose: () => void
}

export function createEditorialMusicLifecycle(
  options: EditorialMusicLifecycleOptions
): EditorialMusicLifecycle {
  let currentDocument = ''
  let initialized = false
  let disposed = false
  const operations: ResolutionOperation[] = []

  const initialize = (document: string) => {
    if (disposed) return
    currentDocument = document
    initialized = true
  }

  const pendingCount = (document: string): number => {
    let count = 0
    for (const line of document.split('\n')) {
      if (parsePending(line) !== undefined) count += 1
    }
    return count
  }

  const preparePaste = (input: {
    readonly document: string
    readonly selections: ReadonlyArray<EditorialMusicSelection>
    readonly text: string
  }): EditorialMusicPaste | null => {
    if (disposed || !initialized || input.document !== currentDocument) return null

    const transformed = Effect.runSync(
      transformPastedEditorialContentEffect(input.text).pipe(Effect.option)
    )
    if (Option.isNone(transformed) || transformed.value.spotifyUrls.length === 0) return null

    const replacement = replaceSelections(
      input.document,
      input.selections,
      transformed.value.content
    )
    if (replacement === null) return null

    const entities = replacement.insertionOffsets.flatMap((from) =>
      trackedEntities(transformed.value.content, from, replacement.document)
    )

    return {
      content: transformed.value.content,
      commit: () => complete({ entities, active: true }, transformed.value.spotifyUrls)
    }
  }

  const update = (document: string, changes: ReadonlyArray<EditorialMusicDocumentChange>) => {
    if (disposed) return
    for (const operation of operations) {
      for (const entity of operation.entities) {
        if (!entity.valid) continue
        const from = entity.from
        const to = entity.to
        if (changes.some((change) => affects(change, entity))) {
          entity.valid = false
          continue
        }

        const offset = changes.reduce(
          (total, change) =>
            change.to <= from ? total + insertedLength(change) - (change.to - change.from) : total,
          0
        )
        entity.from = from + offset
        entity.to = to + offset
      }
    }
    currentDocument = document
  }

  const dispose = () => {
    disposed = true
    for (const operation of operations) operation.active = false
    operations.length = 0
  }

  async function complete(
    operation: ResolutionOperation,
    urls: ReadonlyArray<string>
  ): Promise<EditorialMusicLifecycleSettlement> {
    if (disposed) return emptySettlement()
    operations.push(operation)

    let results: ReadonlyArray<MusicEntityResolution>
    try {
      results = await options.resolve(urls)
    } catch {
      results = urls.map((url): MusicEntityResolution => ({ status: 'failed', url }))
    }

    if (disposed || !operation.active) return emptySettlement()
    operation.active = false
    const index = operations.indexOf(operation)
    if (index >= 0) operations.splice(index, 1)

    const resultsByUrl = new Map(results.map((result) => [result.url, result]))
    const changes: Array<{ readonly from: number; readonly to: number; readonly insert: string }> =
      []
    const failedUrls = new Set<string>()

    for (const entity of operation.entities) {
      if (!entity.valid || !isCurrentPending(currentDocument, entity)) continue
      const result = resultsByUrl.get(entity.url)
      if (result?.status === 'resolved') {
        changes.push({
          from: entity.from,
          to: entity.to,
          insert: serializeMusicEntity(result.reference)
        })
      } else {
        failedUrls.add(entity.url)
        changes.push({
          from: entity.from,
          to: entity.to,
          insert: entity.fallback === 'restore-url' ? entity.url : ''
        })
      }
    }

    return { changes, failureCount: failedUrls.size }
  }

  return { initialize, pendingCount, preparePaste, update, dispose }
}

function trackedEntities(
  content: string,
  from = 0,
  document = content
): Array<TrackedPendingEntity> {
  const entities: Array<TrackedPendingEntity> = []
  let offset = 0

  for (const line of content.split('\n')) {
    const pending = parsePending(line)
    if (pending !== undefined) {
      entities.push({
        ...pending,
        from: from + offset,
        to: from + offset + line.length,
        expected: line,
        valid: true
      })
    }
    offset += line.length + 1
  }

  return entities.filter((entity) => document.slice(entity.from, entity.to) === entity.expected)
}

function parsePending(line: string): PendingMusicEntity | undefined {
  const parsed = Effect.runSync(Effect.option(parsePendingMusicEntityEffect(line)))
  return Option.isSome(parsed) ? parsed.value : undefined
}

function insertedLength(change: EditorialMusicDocumentChange): number {
  return change.insert.length
}

function affects(change: EditorialMusicDocumentChange, entity: TrackedPendingEntity): boolean {
  if (change.to === entity.from && change.insert.endsWith('\n')) return false
  if (change.from === entity.to && change.insert.startsWith('\n')) return false
  return change.from <= entity.to && change.to >= entity.from
}

function isCurrentPending(document: string, entity: TrackedPendingEntity): boolean {
  if (document.slice(entity.from, entity.to) !== entity.expected) return false
  const lineStart = document.lastIndexOf('\n', entity.from - 1) + 1
  const lineEnd = document.indexOf('\n', entity.to)
  return lineStart === entity.from && (lineEnd === -1 || lineEnd === entity.to)
}

function replaceSelections(
  document: string,
  selections: ReadonlyArray<EditorialMusicSelection>,
  content: string
): { readonly document: string; readonly insertionOffsets: ReadonlyArray<number> } | null {
  if (selections.length === 0) return null

  let cursor = 0
  let result = ''
  const insertionOffsets: number[] = []

  for (const selection of selections) {
    if (
      selection.from < cursor ||
      selection.to < selection.from ||
      selection.to > document.length
    ) {
      return null
    }

    result += document.slice(cursor, selection.from)
    insertionOffsets.push(result.length)
    result += content
    cursor = selection.to
  }

  result += document.slice(cursor)
  return { document: result, insertionOffsets }
}

function emptySettlement(): EditorialMusicLifecycleSettlement {
  return { changes: [], failureCount: 0 }
}
