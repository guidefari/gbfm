import { EditorView } from '@codemirror/view'

export interface MarkdownInsertionOptions {
  readonly select?: boolean
}

export function insertMarkdown(
  view: EditorView,
  content: string,
  options: MarkdownInsertionOptions = {}
) {
  const { from, to } = view.state.selection.main
  const selectionEnd = from + content.length

  view.dispatch({
    changes: { from, to, insert: content },
    selection: options.select
      ? { anchor: from, head: selectionEnd }
      : { anchor: selectionEnd, head: selectionEnd }
  })
  view.focus()
}

export function toggleInlineMarkdown(
  view: EditorView,
  prefix: string,
  suffix: string,
  fallback: string
) {
  const { from, to } = view.state.selection.main
  const selected = view.state.doc.sliceString(from, to)
  const isWrapped = selected.startsWith(prefix) && selected.endsWith(suffix)

  if (isWrapped) {
    const unwrapped = selected.slice(prefix.length, selected.length - suffix.length)
    insertMarkdown(view, unwrapped, { select: true })
    return
  }

  const content = selected || fallback
  const insertion = `${prefix}${content}${suffix}`
  view.dispatch({
    changes: { from, to, insert: insertion },
    selection: { anchor: from + prefix.length, head: from + prefix.length + content.length }
  })
  view.focus()
}

export function toggleLinePrefix(
  view: EditorView,
  prefix: string,
  pattern: RegExp = new RegExp(`^${prefix}`)
) {
  const { from, to } = view.state.selection.main
  const start = view.state.doc.lineAt(from).from
  const end = view.state.doc.lineAt(to).to
  const lines = view.state.doc.sliceString(start, end).split('\n')
  const removePrefix = lines.every((line) => !line.trim() || pattern.test(line))
  const content = lines
    .map((line) => {
      if (!line.trim()) return line
      return removePrefix ? line.replace(pattern, '') : `${prefix}${line}`
    })
    .join('\n')

  view.dispatch({
    changes: { from: start, to: end, insert: content },
    selection: { anchor: start, head: start + content.length }
  })
  view.focus()
}

export function insertMarkdownLink(view: EditorView) {
  const { from, to } = view.state.selection.main
  const selected = view.state.doc.sliceString(from, to) || 'link text'
  const insertion = `[${selected}](https://)`
  const urlStart = from + selected.length + 3

  view.dispatch({
    changes: { from, to, insert: insertion },
    selection: { anchor: urlStart, head: urlStart + 'https://'.length }
  })
  view.focus()
}
