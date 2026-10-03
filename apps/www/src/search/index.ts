import { SearchResults, type SearchResultItem } from '@gbfm/api/search'
import { Effect, Schema } from 'effect'
import { Command, Navigation, type Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'
import { defineView } from 'foldkit/submodel'

export const Model = Schema.Struct({
  query: Schema.String,
  status: Schema.Literals(['idle', 'loading', 'ready', 'error']),
  results: Schema.NullOr(SearchResults),
})

export type Model = typeof Model.Type

export const initialModel: Model = { query: '', status: 'idle', results: null }

export const Message = defineMessageUnion({
  Opened: {},
  Closed: {},
  Changed: { query: Schema.String },
  CompletedCancelSearch: { query: Schema.String },
  Loaded: { query: Schema.String, results: SearchResults },
  Failed: { query: Schema.String },
  Completed: {},
  Submitted: {},
})

export type Message = typeof Message.Type

const dialog = () => {
  const element = document.getElementById('global-search')

  return element instanceof HTMLDialogElement ? element : null
}

const SetOpen = Command.define('Search.SetOpen', {
  args: { open: Schema.Boolean },
  messages: [Message.Completed],
  execute: ({ open }) =>
    Effect.sync(() => {
      if (open) dialog()?.showModal()
      else dialog()?.close()

      return Message.Completed()
    }),
})

const Search = Command.define('Search.Query', {
  args: { query: Schema.String },
  interrupt: true,
  messages: [Message.Loaded, Message.Failed],
  execute: ({ query }) =>
    Effect.sleep('200 millis').pipe(
      Effect.andThen(
        Effect.tryPromise(async (signal) => {
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`, {
            signal,
          })

          if (!response.ok) throw new Error('Search unavailable')

          return response.json()
        }),
      ),
      Effect.flatMap(Schema.decodeUnknownEffect(SearchResults)),
      Effect.map((results) => Message.Loaded({ query, results })),
      Effect.catch(() => Effect.succeed(Message.Failed({ query }))),
    ),
})

export const resultHref = (result: SearchResultItem): string | null => {
  const prefix = new Map([
    ['show', 'shows'],
    ['mix', 'mixes'],
    ['track', 'tracks'],
    ['micro', 'tweet'],
    ['post', 'editorial'],
  ]).get(result.type)

  if (prefix) return `/${prefix}/${encodeURIComponent(result.slug)}`

  return result.showSlug ? `/shows/${encodeURIComponent(result.showSlug)}` : null
}

const Navigate = Command.define('Search.Navigate', {
  args: { href: Schema.String },
  messages: [Message.Completed],
  execute: ({ href }) =>
    Effect.sync(() => dialog()?.close()).pipe(
      Effect.andThen(Navigation.pushUrl(href)),
      Effect.as(Message.Completed()),
    ),
})

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match<Update.Return<Model, Message>>(message, {
    Opened: () => ({ model, commands: [SetOpen({ open: true })] }),
    Closed: () => ({
      model: initialModel,
      commands: [SetOpen({ open: false }), Search.Interrupt(() => Message.Completed())],
    }),
    Changed: ({ query }) => ({
      model: { query, results: null, status: query.trim() ? 'loading' : 'idle' },
      commands: [Search.Interrupt(() => Message.CompletedCancelSearch({ query }))],
    }),
    CompletedCancelSearch: ({ query }) => ({
      model,
      commands: query === model.query && query.trim() ? [Search({ query: query.trim() })] : [],
    }),
    Loaded: ({ query, results }) => ({
      model: query === model.query.trim() ? { ...model, results, status: 'ready' } : model,
    }),
    Failed: ({ query }) => ({
      model: query === model.query.trim() ? { ...model, status: 'error' } : model,
    }),
    Completed: () => ({ model }),
    Submitted: () => {
      const first =
        model.results &&
        [...model.results.shows, ...model.results.audio, ...model.results.posts].find((item) =>
          resultHref(item),
        )

      const href = first ? resultHref(first) : null

      return { model, commands: href ? [Navigate({ href })] : [] }
    },
  })

export const view = defineView<Model, Message>((model, h) =>
  h.dialog(
    [h.Id('global-search'), h.Class('search-dialog'), h.AriaLabel('Search')],
    [
      h.form(
        [h.Role('search'), h.OnSubmit(Message.Submitted())],
        [
          h.input([
            h.Type('search'),
            h.AriaLabel('Search query'),
            h.Value(model.query),
            h.Placeholder('Search shows, mixes, tweets, editorial…'),
            h.OnInput((query) => Message.Changed({ query })),
          ]),
          h.button(
            [h.Type('button'), h.AriaLabel('Close search'), h.OnClick(Message.Closed())],
            ['×'],
          ),
        ],
      ),
      model.status === 'loading' ? h.p([h.Role('status')], ['Searching…']) : h.empty,
      model.status === 'error' ? h.p([h.Role('alert')], ['Search failed. Try again.']) : h.empty,
      model.results
        ? h.div(
            [h.Class('search-results')],
            [
              ...(['shows', 'audio', 'posts'] as const).flatMap((group) => {
                const items = model.results?.[group] ?? []

                if (items.length === 0) return []

                return [
                  h.section(
                    [],
                    [
                      h.h2(
                        [],
                        [
                          group === 'audio'
                            ? 'Mixes'
                            : group.charAt(0).toUpperCase() + group.slice(1),
                        ],
                      ),
                      ...items.flatMap((item) => {
                        const href = resultHref(item)

                        return href
                          ? [
                              h.a(
                                [h.Href(href), h.OnClick(Message.Closed())],
                                [
                                  item.thumbnailUrl
                                    ? h.img([
                                        h.Src(item.thumbnailUrl),
                                        h.Alt(''),
                                        h.Loading('lazy'),
                                      ])
                                    : h.empty,
                                  h.span([], [item.title || item.slug]),
                                ],
                              ),
                            ]
                          : []
                      }),
                    ],
                  ),
                ]
              }),
              Object.values(model.results).every((items) => items.length === 0)
                ? h.p([], [`No matches for “${model.query.trim()}”`])
                : h.empty,
            ],
          )
        : h.empty,
    ],
  ),
)

export const startSearchShortcuts = () => {
  const handle = (event: KeyboardEvent) => {
    const typing =
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)

    if (
      !((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') &&
      !(event.key === '/' && !typing)
    )
      return
    event.preventDefault()
    dialog()?.showModal()
  }

  window.addEventListener('keydown', handle)

  return () => window.removeEventListener('keydown', handle)
}
