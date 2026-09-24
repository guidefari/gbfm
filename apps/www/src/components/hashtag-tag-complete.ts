import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export interface HashtagCompletionOptions {
  readonly getAvailableTags: () => readonly string[]
  readonly getSelectedTags: () => readonly string[]
  readonly onSelectTag: (tag: string) => void
}

function toTagToken(value: string): string {
  return value.trim().replace(/\s+/g, '-').toLowerCase()
}

function applyTag(options: HashtagCompletionOptions, tag: string) {
  return (view: EditorView, _completion: Completion, from: number, to: number) => {
    const normalized = toTagToken(tag)
    if (!normalized) return
    const trailing = view.state.sliceDoc(to, to + 1) === ' ' ? to + 1 : to
    view.dispatch({
      changes: { from, to: trailing, insert: '' },
      selection: { anchor: from }
    })
    options.onSelectTag(normalized)
  }
}

export function hashtagTagComplete(options: HashtagCompletionOptions): Extension {
  function source(context: CompletionContext): CompletionResult | null {
    const match = context.matchBefore(/#[\w&-]*/)
    if (!match) return null
    if (match.from === match.to && !context.explicit) return null

    const query = toTagToken(match.text.slice(1))
    const selected = new Set(options.getSelectedTags().map(toTagToken))
    const pool = Array.from(new Set(options.getAvailableTags().map(toTagToken)))

    const suggestions: Completion[] = pool
      .filter((tag) => tag && !selected.has(tag) && tag.startsWith(query))
      .slice(0, 8)
      .map((tag) => ({
        label: `#${tag}`,
        type: 'keyword',
        apply: applyTag(options, tag)
      }))

    if (query && !pool.includes(query) && !selected.has(query)) {
      suggestions.push({
        label: `#${query}`,
        detail: 'new tag',
        type: 'text',
        apply: applyTag(options, query)
      })
    }

    if (suggestions.length === 0) return null

    return {
      from: match.from,
      to: match.to,
      options: suggestions,
      filter: false
    }
  }

  return autocompletion({
    override: [source],
    activateOnTyping: true,
    closeOnBlur: true,
    icons: false
  })
}
