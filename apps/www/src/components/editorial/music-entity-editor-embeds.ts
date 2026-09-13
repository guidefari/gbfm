import { EditorState, RangeSetBuilder, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet } from '@codemirror/view'
import { Effect, Option } from 'effect'
import { parseMusicEntityMarkdownEffect } from '@/components/editor/music-entity/music-entity-markdown'
import { parsePendingMusicEntityEffect } from '@/components/editorial/editorial-paste'
import type { MusicEntityResolution } from './editorial-music-resolution'
import {
  createEditorialMusicLifecycle,
  type EditorialMusicDocumentChange,
  type EditorialMusicSelection
} from './editorial-music-lifecycle'
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
  const lifecycle = createEditorialMusicLifecycle({ resolve: options.resolve })
  const entityState = StateField.define<DecorationSet>({
    create: (state) => {
      const document = state.doc.toString()
      lifecycle.initialize(document)
      options.onPendingChange(lifecycle.pendingCount(document))
      return musicEntityDecorations(state, options)
    },
    update(decorations, transaction) {
      return transaction.docChanged || transaction.selection !== transaction.startState.selection
        ? musicEntityDecorations(transaction.state, options)
        : decorations
    },
    provide: (field) => EditorView.decorations.from(field)
  })

  const lifecycleListener = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return
    const changes: EditorialMusicDocumentChange[] = []
    update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      changes.push({ from: fromA, to: toA, insert: inserted.toString() })
    })
    const document = update.state.doc.toString()
    lifecycle.update(document, changes)
    options.onPendingChange(lifecycle.pendingCount(document))
  })

  const pasteHandler = EditorView.domEventHandlers({
    paste(event, view) {
      const pastedText = event.clipboardData?.getData('text/plain')
      if (!pastedText) return false

      const selections: EditorialMusicSelection[] = view.state.selection.ranges.map(
        ({ from, to }) => ({ from, to })
      )
      const paste = lifecycle.preparePaste({
        document: view.state.doc.toString(),
        selections,
        text: pastedText
      })
      if (!paste) return false

      event.preventDefault()
      view.dispatch({
        ...view.state.replaceSelection(paste.content),
        scrollIntoView: true
      })
      void paste.commit().then((settlement) => {
        if (!view.dom.isConnected) return
        if (settlement.changes.length > 0) view.dispatch({ changes: settlement.changes })
        if (settlement.failureCount > 0) options.onResolutionFailure(settlement.failureCount)
      })
      return true
    }
  })

  const lifecyclePlugin = ViewPlugin.fromClass(
    class {
      destroy() {
        lifecycle.dispose()
        options.onPendingChange(0)
      }
    }
  )

  return [entityState, lifecycleListener, pasteHandler, lifecyclePlugin]
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

function selectionTouchesLine(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((selection) => selection.from <= to && selection.to >= from)
}
