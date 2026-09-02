import { EditorState, RangeSetBuilder, StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { Effect, Option } from 'effect'
import { externalMediaEmbed, type ExternalMediaEmbed } from '@/components/editorial/external-media'
import {
  parseSpotifyEmbedMarkdownEffect,
  transformPastedEditorialContentEffect
} from '@/components/editorial/editorial-paste'

class SpotifyEmbedWidget extends WidgetType {
  constructor(
    readonly embed: ExternalMediaEmbed,
    readonly from: number
  ) {
    super()
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof SpotifyEmbedWidget &&
      other.embed.src === this.embed.src &&
      other.from === this.from
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement('section')
    container.className = 'editorial-spotify-embed'
    container.setAttribute('aria-label', 'Spotify embed')

    const header = document.createElement('div')
    header.className = 'editorial-spotify-embed-header'

    const label = document.createElement('span')
    label.textContent = spotifyEmbedLabel(this.embed.src)

    const editButton = document.createElement('button')
    editButton.type = 'button'
    editButton.className = 'editorial-spotify-embed-edit'
    editButton.textContent = 'Edit link'
    editButton.addEventListener('click', () => {
      view.dispatch({ selection: { anchor: this.from }, scrollIntoView: true })
      view.focus()
    })

    const iframe = document.createElement('iframe')
    iframe.src = this.embed.src
    iframe.title = this.embed.title
    iframe.width = '100%'
    iframe.height = String(this.embed.height)
    iframe.loading = 'lazy'
    iframe.allow = this.embed.allow
    iframe.referrerPolicy = 'strict-origin-when-cross-origin'

    header.append(label, editButton)
    container.append(header, iframe)
    return container
  }
}

const spotifyEmbedState = StateField.define<DecorationSet>({
  create: spotifyDecorations,
  update(decorations, transaction) {
    return transaction.docChanged || transaction.selection !== transaction.startState.selection
      ? spotifyDecorations(transaction.state)
      : decorations
  },
  provide: (field) => EditorView.decorations.from(field)
})

const richMediaPaste = EditorView.domEventHandlers({
  paste(event, view) {
    const pastedText = event.clipboardData?.getData('text/plain')
    if (!pastedText) return false

    const transformed = Effect.runSync(
      transformPastedEditorialContentEffect(pastedText).pipe(
        Effect.catch(() => Effect.succeed(pastedText))
      )
    )
    if (transformed === pastedText) return false

    event.preventDefault()
    view.dispatch({
      ...view.state.replaceSelection(transformed),
      scrollIntoView: true
    })
    return true
  }
})

export const spotifyEditorEmbeds: Extension = [spotifyEmbedState, richMediaPaste]

function spotifyDecorations(state: EditorState): DecorationSet {
  const decorations = new RangeSetBuilder<Decoration>()

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber)
    if (selectionTouchesLine(state, line.from, line.to)) continue

    const media = Effect.runSync(Effect.option(parseSpotifyEmbedMarkdownEffect(line.text)))
    if (Option.isNone(media)) continue

    const embed = externalMediaEmbed(media.value)
    if (embed === null) continue

    decorations.add(
      line.from,
      line.to,
      Decoration.replace({
        widget: new SpotifyEmbedWidget(embed, line.from),
        block: true
      })
    )
  }

  return decorations.finish()
}

function selectionTouchesLine(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((selection) => selection.from <= to && selection.to >= from)
}

function spotifyEmbedLabel(source: string): string {
  const segments = new URL(source).pathname.split('/')
  const type = segments.at(-2)
  return type ? `Spotify ${type}` : 'Spotify player'
}
