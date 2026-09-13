import { describe, expect, test } from 'vitest'
import { serializePendingMusicEntity } from './editorial-paste'
import {
  createEditorialMusicLifecycle,
  type EditorialMusicLifecycleSettlement
} from './editorial-music-lifecycle'
import type { MusicEntityResolution } from './editorial-music-resolution'

type Deferred<T> = {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve = (_value: T): void => {
    throw new Error('Deferred resolver not initialized')
  }
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

function applySettlement(document: string, settlement: EditorialMusicLifecycleSettlement): string {
  return [...settlement.changes]
    .sort((left, right) => right.from - left.from)
    .reduce(
      (result, change) => result.slice(0, change.from) + change.insert + result.slice(change.to),
      document
    )
}

const firstUrl = 'https://open.spotify.com/album/6AwBhTb30oRIH35Og6SdKG'
const secondUrl = 'https://open.spotify.com/album/1tLBaM7LWJkX1zi3K6wuLu'

function createLifecycle(
  resolve: (urls: ReadonlyArray<string>) => Promise<ReadonlyArray<MusicEntityResolution>>
) {
  return createEditorialMusicLifecycle({ resolve })
}

describe('editorial music lifecycle', () => {
  test('counts pending entities in initial content', () => {
    const lifecycle = createLifecycle(async () => [])
    const document = serializePendingMusicEntity(firstUrl)

    lifecycle.initialize(document)

    expect(lifecycle.pendingCount(document)).toBe(1)
  })

  test('reports initial pending content and resolves duplicate URLs once', async () => {
    const response = deferred<ReadonlyArray<MusicEntityResolution>>()
    const requested: Array<ReadonlyArray<string>> = []
    const lifecycle = createLifecycle((urls) => {
      requested.push(urls)
      return response.promise
    })
    const pastedText = `${firstUrl}\n${firstUrl}`

    lifecycle.initialize('')
    const pending = lifecycle.preparePaste({
      document: '',
      selections: [{ from: 0, to: 0 }],
      text: pastedText
    })
    expect(pending).not.toBeNull()
    if (!pending) return
    const document = pending.content
    lifecycle.update(document, [{ from: 0, to: 0, insert: document }])
    expect(lifecycle.pendingCount(document)).toBe(2)
    const settlement = pending.commit()
    response.resolve([
      { status: 'resolved', url: firstUrl, reference: { type: 'album', id: 'album-1' } }
    ])
    const resolved = await settlement

    expect(requested).toEqual([[firstUrl]])
    expect(lifecycle.pendingCount(applySettlement(document, resolved))).toBe(0)
    expect(applySettlement(document, resolved)).toBe(
      '<MusicEntity type="album" id="album-1" />\n<MusicEntity type="album" id="album-1" />'
    )
  })

  test('restores failed URLs and removes inline failures', async () => {
    const lifecycle = createLifecycle(async (urls) =>
      urls.map((url): MusicEntityResolution => ({ status: 'failed', url }))
    )
    lifecycle.initialize('')
    const pending = lifecycle.preparePaste({
      document: '',
      selections: [{ from: 0, to: 0 }],
      text: `${firstUrl}\n\n[Second](${secondUrl})`
    })
    expect(pending).not.toBeNull()
    if (!pending) return
    lifecycle.update(pending.content, [{ from: 0, to: 0, insert: pending.content }])

    const settlement = await pending.commit()

    expect(settlement.failureCount).toBe(2)
    expect(applySettlement(pending.content, settlement)).toBe(
      `${firstUrl}\n\n[Second](${secondUrl})\n\n`
    )
  })

  test('treats missing resolver results as failures', async () => {
    const lifecycle = createLifecycle(async () => [
      { status: 'resolved', url: firstUrl, reference: { type: 'album', id: 'album-1' } }
    ])
    lifecycle.initialize('')
    const pending = lifecycle.preparePaste({
      document: '',
      selections: [{ from: 0, to: 0 }],
      text: `${firstUrl}\n\n[Second](${secondUrl})`
    })
    expect(pending).not.toBeNull()
    if (!pending) return
    lifecycle.update(pending.content, [{ from: 0, to: 0, insert: pending.content }])

    const settlement = await pending.commit()

    expect(settlement.failureCount).toBe(1)
    expect(applySettlement(pending.content, settlement)).toBe(
      `<MusicEntity type="album" id="album-1" />\n\n[Second](${secondUrl})\n\n`
    )
  })

  test('relocates a second in-flight operation after the first settles', async () => {
    const firstResponse = deferred<ReadonlyArray<MusicEntityResolution>>()
    const secondResponse = deferred<ReadonlyArray<MusicEntityResolution>>()
    const lifecycle = createLifecycle((urls) =>
      urls[0] === firstUrl ? firstResponse.promise : secondResponse.promise
    )
    lifecycle.initialize('')
    const firstPending = lifecycle.preparePaste({
      document: '',
      selections: [{ from: 0, to: 0 }],
      text: firstUrl
    })
    expect(firstPending).not.toBeNull()
    if (!firstPending) return
    lifecycle.update(firstPending.content, [{ from: 0, to: 0, insert: firstPending.content }])
    const firstSettlement = firstPending.commit()

    const documentWithSeparator = `${firstPending.content}\n`
    lifecycle.update(documentWithSeparator, [
      { from: firstPending.content.length, to: firstPending.content.length, insert: '\n' }
    ])
    const secondPending = lifecycle.preparePaste({
      document: documentWithSeparator,
      selections: [{ from: documentWithSeparator.length, to: documentWithSeparator.length }],
      text: secondUrl
    })
    expect(secondPending).not.toBeNull()
    if (!secondPending) return
    const documentWithBothPending = `${documentWithSeparator}${secondPending.content}`
    lifecycle.update(documentWithBothPending, [
      {
        from: documentWithSeparator.length,
        to: documentWithSeparator.length,
        insert: secondPending.content
      }
    ])
    const secondSettlement = secondPending.commit()

    firstResponse.resolve([
      { status: 'resolved', url: firstUrl, reference: { type: 'album', id: 'album-1' } }
    ])
    const firstResolved = await firstSettlement
    const documentAfterFirstSettlement = applySettlement(documentWithBothPending, firstResolved)
    lifecycle.update(documentAfterFirstSettlement, firstResolved.changes)

    secondResponse.resolve([
      { status: 'resolved', url: secondUrl, reference: { type: 'album', id: 'album-2' } }
    ])
    const secondResolved = await secondSettlement

    expect(applySettlement(documentAfterFirstSettlement, secondResolved)).toBe(
      '<MusicEntity type="album" id="album-1" />\n<MusicEntity type="album" id="album-2" />'
    )
  })

  test('does not apply a result after the target text changes', async () => {
    const response = deferred<ReadonlyArray<MusicEntityResolution>>()
    const lifecycle = createLifecycle(() => response.promise)
    lifecycle.initialize('')
    const pending = lifecycle.preparePaste({
      document: '',
      selections: [{ from: 0, to: 0 }],
      text: firstUrl
    })
    expect(pending).not.toBeNull()
    if (!pending) return
    lifecycle.update(pending.content, [{ from: 0, to: 0, insert: pending.content }])
    const settlement = pending.commit()
    lifecycle.update('The link was removed.', [
      { from: 0, to: pending.content.length, insert: 'The link was removed.' }
    ])
    response.resolve([
      { status: 'resolved', url: firstUrl, reference: { type: 'album', id: 'album-1' } }
    ])

    expect((await settlement).changes).toEqual([])
  })

  test('tracks pending entities through unrelated edits', async () => {
    const response = deferred<ReadonlyArray<MusicEntityResolution>>()
    const lifecycle = createLifecycle(() => response.promise)
    lifecycle.initialize('')
    const pending = lifecycle.preparePaste({
      document: '',
      selections: [{ from: 0, to: 0 }],
      text: firstUrl
    })
    expect(pending).not.toBeNull()
    if (!pending) return
    lifecycle.update(pending.content, [{ from: 0, to: 0, insert: pending.content }])
    const settlement = pending.commit()
    const prefix = 'Intro\n'
    lifecycle.update(prefix + pending.content, [{ from: 0, to: 0, insert: prefix }])
    response.resolve([
      { status: 'resolved', url: firstUrl, reference: { type: 'album', id: 'album-1' } }
    ])

    expect(applySettlement(prefix + pending.content, await settlement)).toBe(
      'Intro\n<MusicEntity type="album" id="album-1" />'
    )
  })

  test('maps multiple edits from one transaction in original document coordinates', async () => {
    const response = deferred<ReadonlyArray<MusicEntityResolution>>()
    const lifecycle = createLifecycle(() => response.promise)
    const prefix = 'Intro\n'
    lifecycle.initialize(prefix)
    const pending = lifecycle.preparePaste({
      document: prefix,
      selections: [{ from: prefix.length, to: prefix.length }],
      text: firstUrl
    })
    expect(pending).not.toBeNull()
    if (!pending) return
    lifecycle.update(prefix + pending.content, [
      { from: prefix.length, to: prefix.length, insert: pending.content }
    ])
    const settlement = pending.commit()
    const before = 'Before'
    const after = '\nAfter'
    const pendingStart = prefix.length
    const pendingEnd = pendingStart + pending.content.length
    const nextDocument = before + prefix + pending.content + after
    lifecycle.update(nextDocument, [
      { from: 0, to: 0, insert: before },
      { from: pendingEnd, to: pendingEnd, insert: after }
    ])
    response.resolve([
      { status: 'resolved', url: firstUrl, reference: { type: 'album', id: 'album-1' } }
    ])

    expect(applySettlement(nextDocument, await settlement)).toBe(
      `${before}${prefix}<MusicEntity type="album" id="album-1" />${after}`
    )
  })

  test('resolves paste content at every selection', async () => {
    const lifecycle = createLifecycle(async (urls) =>
      urls.map(
        (url): MusicEntityResolution => ({
          status: 'resolved',
          url,
          reference: { type: 'album', id: 'album-1' }
        })
      )
    )
    const document = '\n'
    lifecycle.initialize(document)
    const pending = lifecycle.preparePaste({
      document,
      selections: [
        { from: 0, to: 0 },
        { from: 1, to: 1 }
      ],
      text: firstUrl
    })
    expect(pending).not.toBeNull()
    if (!pending) return
    const nextDocument = `${pending.content}\n${pending.content}`
    lifecycle.update(nextDocument, [
      { from: 0, to: 0, insert: pending.content },
      { from: 1, to: 1, insert: pending.content }
    ])

    expect(applySettlement(nextDocument, await pending.commit())).toBe(
      '<MusicEntity type="album" id="album-1" />\n<MusicEntity type="album" id="album-1" />'
    )
  })

  test('keeps pending content valid when a preceding line is replaced', async () => {
    const response = deferred<ReadonlyArray<MusicEntityResolution>>()
    const lifecycle = createLifecycle(() => response.promise)
    const document = 'old\n'
    lifecycle.initialize(document)
    const pending = lifecycle.preparePaste({
      document,
      selections: [{ from: document.length, to: document.length }],
      text: firstUrl
    })
    expect(pending).not.toBeNull()
    if (!pending) return
    const pendingDocument = `${document}${pending.content}`
    lifecycle.update(pendingDocument, [
      { from: document.length, to: document.length, insert: pending.content }
    ])
    const settlement = pending.commit()
    const nextDocument = `new\n${pending.content}`
    lifecycle.update(nextDocument, [{ from: 0, to: document.length, insert: 'new\n' }])
    response.resolve([
      { status: 'resolved', url: firstUrl, reference: { type: 'album', id: 'album-1' } }
    ])

    expect(applySettlement(nextDocument, await settlement)).toBe(
      'new\n<MusicEntity type="album" id="album-1" />'
    )
  })

  test('ignores results after teardown', async () => {
    const response = deferred<ReadonlyArray<MusicEntityResolution>>()
    const lifecycle = createLifecycle(() => response.promise)
    lifecycle.initialize('')
    const pending = lifecycle.preparePaste({
      document: '',
      selections: [{ from: 0, to: 0 }],
      text: firstUrl
    })
    expect(pending).not.toBeNull()
    if (!pending) return
    lifecycle.update(pending.content, [{ from: 0, to: 0, insert: pending.content }])
    const settlement = pending.commit()
    lifecycle.dispose()
    response.resolve([
      { status: 'resolved', url: firstUrl, reference: { type: 'album', id: 'album-1' } }
    ])

    expect(await settlement).toEqual({ changes: [], failureCount: 0 })
  })
})
