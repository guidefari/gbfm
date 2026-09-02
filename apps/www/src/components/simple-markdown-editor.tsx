import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  keymap,
  placeholder as editorPlaceholder
} from '@codemirror/view'
import { compile } from '@mdx-js/mdx'
import {
  Bold,
  Code2,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Rows3,
  SquarePen,
  Strikethrough
} from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { MusicEntity } from '@/components/editor/music-entity/MusicEntity'
import {
  createMusicEntityEditorEmbeds,
  type MusicEntityWidget
} from '@/components/editorial/music-entity-editor-embeds'
import type { MusicEntityResolution } from '@/components/editorial/editorial-music-resolution'
import { log } from '@/services/logger'
import { MDXRendrr } from './MDXRendrr'
import {
  insertMarkdown,
  insertMarkdownLink,
  toggleInlineMarkdown,
  toggleLinePrefix,
  type MarkdownInsertionOptions
} from './markdown-editor-commands'
import './editor.css'

interface SimpleMarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  toolbarActions?: ReactNode
  resolveMusicEntities?: (
    urls: ReadonlyArray<string>
  ) => Promise<ReadonlyArray<MusicEntityResolution>>
  onPendingMusicChange?: (count: number) => void
  onMusicResolutionFailure?: (count: number) => void
}

export interface SimpleMarkdownEditorHandle {
  focus: () => void
  insertAtCursor: (content: string, options?: MarkdownInsertionOptions) => void
}

type EditorMode = 'edit' | 'preview' | 'split'

type PreviewState =
  | { readonly status: 'empty' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly content: string }
  | { readonly status: 'error'; readonly message: string }

const editorModes: ReadonlyArray<{
  readonly value: EditorMode
  readonly label: string
  readonly icon: ReactNode
}> = [
  { value: 'edit', label: 'Edit', icon: <SquarePen className='size-3.5' /> },
  { value: 'preview', label: 'Preview', icon: <Eye className='size-3.5' /> },
  { value: 'split', label: 'Split', icon: <Rows3 className='size-3.5' /> }
]

const editorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      fontSize: '0.9375rem'
    },
    '.cm-content': {
      caretColor: 'var(--pastel-green-2)',
      fontFamily: 'inherit',
      fontSize: '1.0625rem',
      lineHeight: '1.8',
      minHeight: '32rem',
      padding: '2rem clamp(1rem, 4vw, 3rem) 5rem'
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--pastel-green-2)' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      borderRight: '1px solid color-mix(in srgb, var(--pastel-green-2) 16%, transparent)',
      color: 'color-mix(in srgb, var(--foreground) 38%, transparent)'
    },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'color-mix(in srgb, var(--pastel-green-2) 32%, transparent)'
    },
    '.cm-placeholder': { color: 'color-mix(in srgb, var(--foreground) 42%, transparent)' },
    '.cm-tooltip': {
      backgroundColor: 'var(--card)',
      border: '1px solid color-mix(in srgb, var(--pastel-green-2) 20%, transparent)'
    }
  },
  { dark: true }
)

function createExtensions(
  onChange: { current: (value: string) => void },
  syncing: { current: boolean },
  placeholderCompartment: Compartment,
  placeholder: string | undefined,
  musicEntityExtensions: ReadonlyArray<ReturnType<typeof createMusicEntityEditorEmbeds>>
) {
  return [
    markdown(),
    history(),
    syntaxHighlighting(defaultHighlightStyle),
    highlightActiveLine(),
    EditorView.lineWrapping,
    editorTheme,
    ...musicEntityExtensions,
    placeholderCompartment.of(editorPlaceholder(placeholder ?? '')),
    keymap.of([
      { key: 'Mod-b', run: (view) => (toggleInlineMarkdown(view, '**', '**', 'bold text'), true) },
      { key: 'Mod-i', run: (view) => (toggleInlineMarkdown(view, '_', '_', 'italic text'), true) },
      { key: 'Mod-k', run: (view) => (insertMarkdownLink(view), true) },
      ...defaultKeymap,
      ...historyKeymap
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !syncing.current) {
        onChange.current(update.state.doc.toString())
      }
    })
  ]
}

function EditorControl({ children, className, ...props }: ComponentProps<'button'>) {
  return (
    <button type='button' className={`editorial-editor-control ${className ?? ''}`} {...props}>
      {children}
    </button>
  )
}

function ToolbarButton({
  label,
  icon,
  onClick
}: {
  label: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <EditorControl aria-label={label} title={label} onClick={onClick}>
      {icon}
    </EditorControl>
  )
}

function PreviewPanel({ preview }: { preview: PreviewState }) {
  if (preview.status === 'empty') {
    return (
      <div className='editorial-editor-empty-state'>
        <Eye className='size-5' aria-hidden='true' />
        <p>Your rendered editorial will appear here.</p>
      </div>
    )
  }

  if (preview.status === 'loading') {
    return <div className='editorial-editor-empty-state'>Rendering preview…</div>
  }

  if (preview.status === 'error') {
    return (
      <div className='editorial-editor-error-state' role='alert'>
        <p className='font-medium'>We could not render this preview.</p>
        <p className='mt-1 text-sm'>{preview.message}</p>
      </div>
    )
  }

  return <MDXRendrr mdxString={preview.content} />
}

function ignorePendingMusic(): void {}

async function createPreview(content: string): Promise<PreviewState> {
  if (!content.trim()) return { status: 'empty' }

  try {
    const compiled = await compile(content, { outputFormat: 'function-body' })
    return { status: 'ready', content: compiled.toString() }
  } catch (error) {
    log('error', 'MDX compilation error', { error })
    return {
      status: 'error',
      message: 'Check your Markdown or embeds and try again.'
    }
  }
}

export const SimpleMarkdownEditor = forwardRef<
  SimpleMarkdownEditorHandle,
  SimpleMarkdownEditorProps
>(function SimpleMarkdownEditor(
  {
    value,
    onChange,
    placeholder,
    toolbarActions,
    resolveMusicEntities,
    onPendingMusicChange = ignorePendingMusic,
    onMusicResolutionFailure = ignorePendingMusic
  },
  ref
) {
  const editorHost = useRef<HTMLDivElement | null>(null)
  const editorView = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const syncing = useRef(false)
  const placeholderCompartment = useRef(new Compartment())
  const acceptingWidgets = useRef(true)
  const initialEditorConfig = useRef({
    value,
    placeholder,
    resolveMusicEntities,
    onPendingMusicChange,
    onMusicResolutionFailure
  })
  const [mode, setMode] = useState<EditorMode>('edit')
  const [preview, setPreview] = useState<PreviewState>({ status: 'empty' })
  const [musicEntityWidgets, setMusicEntityWidgets] = useState<ReadonlyArray<MusicEntityWidget>>([])
  onChangeRef.current = onChange

  const mountMusicEntity = useCallback((widget: MusicEntityWidget) => {
    if (!acceptingWidgets.current) return
    setMusicEntityWidgets((widgets) => [
      ...widgets.filter((current) => current.host !== widget.host),
      widget
    ])
  }, [])

  const unmountMusicEntity = useCallback((host: HTMLElement) => {
    if (!acceptingWidgets.current) return
    setMusicEntityWidgets((widgets) => widgets.filter((widget) => widget.host !== host))
  }, [])

  useEffect(() => {
    const host = editorHost.current
    if (!host) return () => {}

    acceptingWidgets.current = true
    const config = initialEditorConfig.current
    const musicEntityExtensions = config.resolveMusicEntities
      ? [
          createMusicEntityEditorEmbeds({
            resolve: config.resolveMusicEntities,
            mount: mountMusicEntity,
            unmount: unmountMusicEntity,
            onPendingChange: config.onPendingMusicChange,
            onResolutionFailure: config.onMusicResolutionFailure
          })
        ]
      : []
    const view = new EditorView({
      state: EditorState.create({
        doc: config.value,
        extensions: createExtensions(
          onChangeRef,
          syncing,
          placeholderCompartment.current,
          config.placeholder,
          musicEntityExtensions
        )
      }),
      parent: host
    })
    editorView.current = view

    return () => {
      acceptingWidgets.current = false
      config.onPendingMusicChange(0)
      view.destroy()
      if (editorView.current === view) editorView.current = null
    }
  }, [mountMusicEntity, unmountMusicEntity])

  useEffect(() => {
    const view = editorView.current
    if (!view) return
    view.dispatch({
      effects: placeholderCompartment.current.reconfigure(editorPlaceholder(placeholder ?? ''))
    })
  }, [placeholder])

  useEffect(() => {
    const view = editorView.current
    if (!view || view.state.doc.toString() === value) return

    syncing.current = true
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    syncing.current = false
  }, [value])

  useEffect(() => {
    if (mode === 'edit') return () => {}
    let cancelled = false
    setPreview(value.trim() ? { status: 'loading' } : { status: 'empty' })

    const timeout = window.setTimeout(() => {
      void createPreview(value).then((result) => {
        if (!cancelled) setPreview(result)
      })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [mode, value])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editorView.current?.focus(),
      insertAtCursor: (content, options) => {
        const view = editorView.current
        if (view) insertMarkdown(view, content, options)
      }
    }),
    []
  )

  const withEditor = (command: (view: EditorView) => void) => {
    const view = editorView.current
    if (view) command(view)
  }

  const isSplit = mode === 'split'
  const showEditor = mode !== 'preview'
  const showPreview = mode !== 'edit'

  return (
    <section className='editorial-editor' aria-label='Markdown editor'>
      <div className='editorial-editor-topbar'>
        <div className='editorial-editor-toolbar' aria-label='Formatting controls'>
          <div className='editorial-editor-toolbar-group'>
            <ToolbarButton
              label='Heading'
              icon={<Heading2 className='size-4' />}
              onClick={() => withEditor((view) => toggleLinePrefix(view, '## '))}
            />
            <ToolbarButton
              label='Bold, Command B'
              icon={<Bold className='size-4' />}
              onClick={() =>
                withEditor((view) => toggleInlineMarkdown(view, '**', '**', 'bold text'))
              }
            />
            <ToolbarButton
              label='Italic, Command I'
              icon={<Italic className='size-4' />}
              onClick={() =>
                withEditor((view) => toggleInlineMarkdown(view, '_', '_', 'italic text'))
              }
            />
            <ToolbarButton
              label='Strikethrough'
              icon={<Strikethrough className='size-4' />}
              onClick={() =>
                withEditor((view) => toggleInlineMarkdown(view, '~~', '~~', 'struck text'))
              }
            />
          </div>
          <div className='editorial-editor-toolbar-group'>
            <ToolbarButton
              label='Link, Command K'
              icon={<Link2 className='size-4' />}
              onClick={() => withEditor(insertMarkdownLink)}
            />
            <ToolbarButton
              label='Inline code'
              icon={<Code2 className='size-4' />}
              onClick={() => withEditor((view) => toggleInlineMarkdown(view, '`', '`', 'code'))}
            />
            <ToolbarButton
              label='Quote'
              icon={<Quote className='size-4' />}
              onClick={() => withEditor((view) => toggleLinePrefix(view, '> '))}
            />
          </div>
          <div className='editorial-editor-toolbar-group'>
            <ToolbarButton
              label='Bulleted list'
              icon={<List className='size-4' />}
              onClick={() => withEditor((view) => toggleLinePrefix(view, '- '))}
            />
            <ToolbarButton
              label='Numbered list'
              icon={<ListOrdered className='size-4' />}
              onClick={() => withEditor((view) => toggleLinePrefix(view, '1. ', /^\d+\.\s/))}
            />
          </div>
          {toolbarActions ? (
            <div className='editorial-editor-toolbar-actions'>{toolbarActions}</div>
          ) : null}
        </div>
        <div className='editorial-editor-modes' aria-label='Editor view'>
          {editorModes.map((item) => (
            <EditorControl
              key={item.value}
              className={mode === item.value ? 'editorial-editor-mode-active' : ''}
              aria-pressed={mode === item.value}
              onClick={() => setMode(item.value)}>
              {item.icon}
              <span>{item.label}</span>
            </EditorControl>
          ))}
        </div>
      </div>

      <div className={isSplit ? 'grid overflow-hidden md:grid-cols-2' : 'overflow-hidden'}>
        <div
          className={`editorial-editor-pane editorial-editor-source ${showEditor ? '' : 'hidden'}`}>
          <div ref={editorHost} className='editorial-editor-codemirror' />
        </div>
        {showPreview ? (
          <div className='editorial-editor-pane editorial-editor-preview prose prose-invert max-w-none'>
            <PreviewPanel preview={preview} />
          </div>
        ) : null}
      </div>
      {musicEntityWidgets.map((widget) =>
        createPortal(
          <MusicEntity type={widget.reference.type} id={widget.reference.id} />,
          widget.host,
          widget.key
        )
      )}
    </section>
  )
})
