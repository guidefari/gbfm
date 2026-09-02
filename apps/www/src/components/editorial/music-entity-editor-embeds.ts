import { EditorState, RangeSetBuilder, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { Effect, Option } from 'effect'
import {
  parseMusicEntityMarkdownEffect,
  serializeMusicEntity
} from '@/components/editor/music-entity/music-entity-markdown'
import {
  parsePendingMusicEntityEffect,
  transformPastedEditorialContentEffect
} from '@/components/editorial/editorial-paste'
import type { MusicEntityResolution } from './editorial-music-resolution'
import {
  PendingMusicEntityWidget,
  ResolvedMusicEntityWidget,
  type MusicEntityWidgetLifecycle
} from './music-entity-editor-widgets'

export type { MusicEntityWidget } from './music-entity-editor-widgets'

export type MusicEntityEditorOptions = MusicEntityWidgetLifecycle & {
  readonly resolve: (urls: ReadonlyArray<string>) => Promise<ReadonlyArray<MusicEntityResolution>>
  readonly onPendingChange: (count: number) => void
  readonly onResolutionFailure: (count: number) => void
}

export function createMusicEntityEditorEmbeds(options: MusicEntityEditorOptions): Extension {
  const entityState = StateField.define<DecorationSet>({
    create: (state) => musicEntityDecorations(state, options),
    update(decorations, transaction) {
      return transaction.docChanged || transaction.selection !== transaction.startState.selection
        ? musicEntityDecorations(transaction.state, options)
        : decorations
    },
    provide: (field) => EditorView.decorations.from(field)
  })

  const pendingListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) options.onPendingChange(countPendingEntities(update.state))
  })

  const pasteHandler = EditorView.domEventHandlers({
    paste(event, view) {
      const pastedText = event.clipboardData?.getData('text/plain')
      if (!pastedText) return false

      const transformed = Effect.runSync(
        transformPastedEditorialContentEffect(pastedText).pipe(
          Effect.catch(() =>
            Effect.succeed({ content: pastedText, spotifyUrls: new Array<string>() })
          )
        )
      )
      if (transformed.spotifyUrls.length === 0) return false

      event.preventDefault()
      view.dispatch({
        ...view.state.replaceSelection(transformed.content),
        scrollIntoView: true
      })

      void options
        .resolve(transformed.spotifyUrls)
        .then((results) => settlePendingEntities(view, results, options))
        .catch(() => {
          const failed = transformed.spotifyUrls.map(
            (url): MusicEntityResolution => ({ status: 'failed', url })
          )
          settlePendingEntities(view, failed, options)
        })
      return true
    }
  })

  return [entityState, pendingListener, pasteHandler]
}

function musicEntityDecorations(
  state: EditorState,
  options: MusicEntityEditorOptions
): DecorationSet {
  const decorations = new RangeSetBuilder<Decoration>()

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber)
    const pending = Effect.runSync(Effect.option(parsePendingMusicEntityEffect(line.text)))
    if (Option.isSome(pending)) {
      decorations.add(
        line.from,
        line.to,
        Decoration.replace({
          widget: new PendingMusicEntityWidget(pending.value.url),
          block: true
        })
      )
      continue
    }

    if (selectionTouchesLine(state, line.from, line.to)) continue
    const reference = Effect.runSync(Effect.option(parseMusicEntityMarkdownEffect(line.text)))
    if (Option.isNone(reference)) continue

    decorations.add(
      line.from,
      line.to,
      Decoration.replace({
        widget: new ResolvedMusicEntityWidget(
          reference.value,
          line.from,
          options.mount,
          options.unmount
        ),
        block: true
      })
    )
  }

  return decorations.finish()
}

function settlePendingEntities(
  view: EditorView,
  results: ReadonlyArray<MusicEntityResolution>,
  options: MusicEntityEditorOptions
): void {
  if (!view.dom.isConnected) return

  const resultsByUrl = new Map(results.map((result) => [result.url, result]))
  const changes: Array<{ readonly from: number; readonly to: number; readonly insert: string }> = []

  for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber += 1) {
    const line = view.state.doc.line(lineNumber)
    const pending = Effect.runSync(Effect.option(parsePendingMusicEntityEffect(line.text)))
    if (Option.isNone(pending)) continue

    const result = resultsByUrl.get(pending.value.url)
    if (!result) continue

    changes.push({
      from: line.from,
      to: line.to,
      insert: result.status === 'resolved' ? serializeMusicEntity(result.reference) : result.url
    })
  }

  if (changes.length > 0) view.dispatch({ changes })
  const failureCount = results.filter((result) => result.status === 'failed').length
  if (failureCount > 0) options.onResolutionFailure(failureCount)
}

function countPendingEntities(state: EditorState): number {
  let count = 0
  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber)
    const pending = Effect.runSync(Effect.option(parsePendingMusicEntityEffect(line.text)))
    if (Option.isSome(pending)) count += 1
  }
  return count
}

function selectionTouchesLine(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((selection) => selection.from <= to && selection.to >= from)
}
