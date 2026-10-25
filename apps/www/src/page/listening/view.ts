import type { SavedMix } from '@gbfm/api/listening'
import { inertHtml as h } from 'foldkit/html'

import type { ListeningPage } from './document'

const panel = 'border border-border bg-card p-4 sm:p-5'

const fieldClass =
  'w-full border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-highlight'

const buttonClass =
  'inline-flex min-h-10 items-center justify-center border border-border px-3 py-2 text-sm font-semibold hover:border-highlight hover:text-highlight focus-visible:outline-2 focus-visible:outline-highlight'

const hidden = (name: string, value: string) =>
  h.input([h.Type('hidden'), h.Name(name), h.Value(value)])

const button = (label: string) => h.button([h.Type('submit'), h.Class(buttonClass)], [label])

const textField = (name: string, label: string, value = '', required = false) =>
  h.label(
    [h.Class('grid gap-2 text-sm')],
    [
      label,
      h.input([
        h.Name(name),
        h.Value(value),
        h.Required(required),
        h.Maxlength(300),
        h.Class(fieldClass),
      ]),
    ],
  )

const checkbox = (name: string, label: string, checked = false) =>
  h.label(
    [h.Class('flex items-start gap-2 text-sm')],
    [
      h.input([
        h.Type('checkbox'),
        h.Name(name),
        h.Value('true'),
        h.Checked(checked),
        h.Class('mt-1 accent-current'),
      ]),
      label,
    ],
  )

const action = (operation: string, children: Parameters<typeof h.form>[1]) =>
  h.form(
    [h.Method('post'), h.Action(`/actions/listening/${operation}`), h.Class('grid gap-4')],
    children,
  )

const source = (mix: SavedMix) =>
  h.div(
    [h.Class('flex flex-wrap items-center gap-3 text-xs')],
    [
      h.span([h.Class('uppercase tracking-widest text-highlight')], [mix.platform]),
      h.a(
        [
          h.Href(mix.url),
          h.Target('_blank'),
          h.Rel('noopener noreferrer'),
          h.Class('underline underline-offset-4'),
        ],
        ['Open on original platform ↗'],
      ),
    ],
  )

const embed = (mix: SavedMix) =>
  mix.embedUrl
    ? h.details(
        [h.Class('mt-4 border-t border-border pt-3 text-sm')],
        [
          h.summary(
            [h.Class('cursor-pointer py-1 text-muted-foreground hover:text-foreground')],
            ['Listen here'],
          ),
          h.iframe(
            [
              h.Src(mix.embedUrl),
              h.Title(`Listen to ${mix.title}`),
              h.Loading('lazy'),
              h.Attribute('allow', 'encrypted-media; fullscreen; picture-in-picture'),
              h.Class('mt-3 w-full h-64 border-0 bg-background'),
            ],
            [],
          ),
        ],
      )
    : h.empty

const mixCard = (mix: SavedMix, page: ListeningPage) =>
  h.article(
    [h.Key(mix.id), h.Class(panel)],
    [
      h.div(
        [h.Class('flex items-start justify-between gap-3')],
        [
          h.h2([h.Class('text-lg font-bold break-words')], [mix.title]),
          page.workspace
            ? h.span(
                [h.Class('shrink-0 border border-border px-2 py-1 text-xs text-muted-foreground')],
                [mix.published ? 'Published' : 'Private draft'],
              )
            : h.empty,
        ],
      ),
      h.div([h.Class('mt-3')], [source(mix)]),
      !page.workspace && mix.notes
        ? h.p([h.Class('mt-5 whitespace-pre-wrap break-words text-sm leading-7')], [mix.notes])
        : h.empty,
      embed(mix),
      page.workspace
        ? h.details(
            [h.Class('mt-4 border-t border-border pt-3')],
            [
              h.summary(
                [h.Class('cursor-pointer py-1 text-sm font-semibold hover:text-highlight')],
                [`Notes & collections · ${mix.status.replaceAll('-', ' ')}`],
              ),
              h.div(
                [h.Class('mt-4 grid gap-5')],
                [
                  action('edit-mix', [
                    hidden('id', mix.id),
                    textField('title', 'Mix title', mix.title, true),
                    h.label(
                      [h.Class('grid gap-2 text-sm')],
                      [
                        'Listening notes',
                        h.textarea([
                          h.Name('notes'),
                          h.Value(mix.notes),
                          h.Rows(6),
                          h.Maxlength(20000),
                          h.Class(fieldClass),
                        ]),
                      ],
                    ),
                    h.p(
                      [h.Class('text-xs leading-5 text-muted-foreground')],
                      [
                        'One draft, one set of notes. Publishing makes these notes visible in your public collections. Edits to published notes go live when saved.',
                      ],
                    ),
                    h.label(
                      [h.Class('grid gap-2 text-sm')],
                      [
                        'Listening status',
                        h.select(
                          [h.Name('status'), h.Class(fieldClass)],
                          (['to-listen', 'listening', 'listened'] as const).map((status) =>
                            h.option(
                              [h.Value(status), h.Selected(mix.status === status)],
                              [status.replaceAll('-', ' ')],
                            ),
                          ),
                        ),
                      ],
                    ),
                    checkbox('published', 'Publish this mix and its notes', mix.published),
                    button('Save notes & status'),
                  ]),
                  page.document.collections.length
                    ? h.div(
                        [h.Class('grid gap-2')],
                        [
                          h.h3([h.Class('text-sm font-semibold')], ['In your collections']),
                          ...page.document.collections.map((collection) => {
                            const included = page.document.memberships.some(
                              (link) =>
                                link.collectionId === collection.id && link.mixId === mix.id,
                            )

                            return action('membership', [
                              hidden('id', collection.id),
                              hidden('mixId', mix.id),
                              hidden('included', String(!included)),
                              button(
                                `${included ? '− Remove from' : '+ Add to'} ${collection.title}`,
                              ),
                            ])
                          }),
                        ],
                      )
                    : h.empty,
                  action('delete-mix', [hidden('id', mix.id), button('Remove saved mix')]),
                ],
              ),
            ],
          )
        : h.empty,
    ],
  )

/** Native forms and disclosures keep capture, notes and publishing usable without JavaScript. */
export const view = (page: ListeningPage, url: URL, signedIn: boolean) => {
  const selected = url.searchParams.get('collection')
  const status = url.searchParams.get('status')

  const collection = page.workspace
    ? page.document.collections.find((item) => item.id === selected)
    : page.document.collections[0]

  const mixes = page.document.mixes.filter(
    (mix) =>
      (!selected ||
        page.document.memberships.some(
          (link) => link.collectionId === selected && link.mixId === mix.id,
        )) &&
      (!status || mix.status === status),
  )

  const directory = !page.workspace && url.pathname === '/collections'

  return h.section(
    [h.Class('mx-auto max-w-6xl px-4 py-8 pb-32')],
    [
      h.header(
        [h.Class('mb-8 border-b border-border pb-5')],
        [
          h.p(
            [h.Class('mb-2 text-xs uppercase tracking-widest text-highlight')],
            ['Collected frequencies'],
          ),
          h.h1(
            [h.Class('text-3xl font-extrabold')],
            [
              page.workspace
                ? 'Your listening pile'
                : directory
                  ? 'Mix collections'
                  : (collection?.title ?? 'Collection'),
            ],
          ),
          h.p(
            [h.Class('mt-3 max-w-2xl text-sm leading-6 text-muted-foreground')],
            [
              page.workspace
                ? 'Save freely. Listen closely. Share what stays with you.'
                : directory
                  ? 'Selections and listening notes from people who care about the music.'
                  : `${collection?.description ?? ''}${collection ? ` · Collected by ${collection.ownerName}` : ''}`,
            ],
          ),
          h.div(
            [h.Class('mt-4 flex flex-wrap gap-4 text-sm underline underline-offset-4')],
            [
              h.a([h.Href('/collections')], ['Public collections']),
              h.a([h.Href('/listening')], ['Your listening pile']),
            ],
          ),
        ],
      ),
      page.error
        ? h.p([h.Role('alert'), h.Class('mb-5 border border-border p-4 text-sm')], [page.error])
        : h.empty,
      url.searchParams.has('saved')
        ? h.p(
            [h.Role('status'), h.Class('mb-5 text-sm text-highlight')],
            ['Saved. Your changes are up to date.'],
          )
        : h.empty,
      page.workspace && !signedIn
        ? h.div(
            [h.Class(panel)],
            [
              h.p([], ['Sign in to save mixes, write notes and build your own collections.']),
              h.a(
                [h.Href('/auth/sign-in?returnTo=%2Flistening'), h.Class(`${buttonClass} mt-4`)],
                ['Sign in'],
              ),
              h.a(
                [
                  h.Href('/auth/sign-up?returnTo=%2Flistening'),
                  h.Class(`${buttonClass} mt-4 ml-3`),
                ],
                ['Create account'],
              ),
            ],
          )
        : h.empty,
      page.workspace && signedIn
        ? h.div(
            [h.Class('grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]')],
            [
              h.aside(
                [h.Class('grid content-start gap-5')],
                [
                  h.nav(
                    [h.AriaLabel('Your collections'), h.Class(`${panel} grid gap-3 text-sm`)],
                    [
                      h.h2([h.Class('font-bold')], ['Your collections']),
                      h.a(
                        [h.Href('/listening'), h.Class('hover:text-highlight')],
                        [`All saved mixes (${page.document.mixes.length})`],
                      ),
                      ...page.document.collections.map((item) =>
                        h.a(
                          [
                            h.Href(`/listening?collection=${encodeURIComponent(item.id)}`),
                            h.Class(
                              `break-words hover:text-highlight ${selected === item.id ? 'text-highlight' : ''}`,
                            ),
                          ],
                          [`${item.title} · ${item.published ? 'public' : 'private'}`],
                        ),
                      ),
                    ],
                  ),
                  h.details(
                    [h.Class(panel)],
                    [
                      h.summary(
                        [h.Class('cursor-pointer text-sm font-semibold')],
                        ['+ New collection'],
                      ),
                      h.div(
                        [h.Class('mt-4')],
                        [
                          action('create-collection', [
                            textField('title', 'Collection name', '', true),
                            textField('description', 'Description'),
                            checkbox('published', 'Make collection public'),
                            button('Create collection'),
                          ]),
                        ],
                      ),
                    ],
                  ),
                  collection
                    ? h.details(
                        [h.Class(panel)],
                        [
                          h.summary(
                            [h.Class('cursor-pointer text-sm font-semibold')],
                            ['Collection settings'],
                          ),
                          h.div(
                            [h.Class('mt-4 grid gap-4')],
                            [
                              action('edit-collection', [
                                hidden('id', collection.id),
                                textField('title', 'Collection name', collection.title, true),
                                textField('description', 'Description', collection.description),
                                checkbox(
                                  'published',
                                  'Make collection public',
                                  collection.published,
                                ),
                                button('Save collection'),
                              ]),
                              collection.published
                                ? h.a(
                                    [
                                      h.Href(`/collections/${collection.id}`),
                                      h.Class('text-sm underline'),
                                    ],
                                    ['View public collection ↗'],
                                  )
                                : h.empty,
                              action('delete-collection', [
                                hidden('id', collection.id),
                                button('Delete collection'),
                              ]),
                            ],
                          ),
                        ],
                      )
                    : h.empty,
                ],
              ),
              h.div(
                [h.Class('min-w-0 grid content-start gap-5')],
                [
                  h.div(
                    [h.Class(panel)],
                    [
                      h.h2([h.Class('mb-3 text-lg font-bold')], ['Add to your listening pile']),
                      h.form(
                        [h.Method('get'), h.Action('/listening'), h.Class('grid gap-3')],
                        [
                          h.label(
                            [h.Class('grid gap-2 text-sm')],
                            [
                              'Mix or public playlist URL',
                              h.input([
                                h.Type('url'),
                                h.Name('import'),
                                h.Required(true),
                                h.Maxlength(2048),
                                h.Placeholder('https://…'),
                                h.Class(fieldClass),
                              ]),
                            ],
                          ),
                          button('Preview import'),
                        ],
                      ),
                      h.p(
                        [h.Class('mt-3 text-xs leading-5 text-muted-foreground')],
                        [
                          'YouTube · Spotify · SoundCloud · Mixcloud. Playlist imports are one-time snapshots, never synced. Existing saves keep their notes.',
                        ],
                      ),
                      h.details(
                        [h.Class('mt-4 text-sm')],
                        [
                          h.summary(
                            [h.Class('cursor-pointer')],
                            ['Paste several individual links'],
                          ),
                          h.div(
                            [h.Class('mt-3')],
                            [
                              action('bulk-links', [
                                h.label(
                                  [h.Class('grid gap-2')],
                                  [
                                    'One mix URL per line (up to 200)',
                                    h.textarea([
                                      h.Name('links'),
                                      h.Rows(5),
                                      h.Required(true),
                                      h.Class(fieldClass),
                                    ]),
                                  ],
                                ),
                                button('Save links privately'),
                              ]),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                  page.preview
                    ? h.div(
                        [h.Class(panel)],
                        [
                          h.h2(
                            [h.Class('mb-3 font-bold')],
                            [`Import preview · ${page.preview.items.length} mixes`],
                          ),
                          ...page.preview.warnings.map((warning) =>
                            h.p([h.Class('mb-3 text-sm text-muted-foreground')], [warning]),
                          ),
                          action('save-import', [
                            ...page.preview.items.map((item) =>
                              h.label(
                                [h.Class('flex gap-3 break-words text-sm')],
                                [
                                  h.input([
                                    h.Type('checkbox'),
                                    h.Name('item'),
                                    h.Value(JSON.stringify(item)),
                                    h.Checked(true),
                                  ]),
                                  h.span([h.Class('min-w-0 break-all')], [item.title]),
                                ],
                              ),
                            ),
                            page.preview.items.length > 0
                              ? button('Save selected mixes privately')
                              : h.empty,
                          ]),
                        ],
                      )
                    : h.empty,
                  h.form(
                    [
                      h.Method('get'),
                      h.Action('/listening'),
                      h.Class('flex flex-wrap items-end gap-3'),
                    ],
                    [
                      selected ? hidden('collection', selected) : h.empty,
                      h.label(
                        [h.Class('grid gap-2 text-xs')],
                        [
                          'Listening status',
                          h.select(
                            [h.Name('status'), h.Class(fieldClass)],
                            [
                              h.option([h.Value('')], ['All statuses']),
                              ...['to-listen', 'listening', 'listened'].map((item) =>
                                h.option(
                                  [h.Value(item), h.Selected(status === item)],
                                  [item.replaceAll('-', ' ')],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      button('Filter'),
                    ],
                  ),
                  ...mixes.map((mix) => mixCard(mix, page)),
                  mixes.length === 0
                    ? h.p(
                        [h.Class('py-8 text-sm text-muted-foreground')],
                        [
                          'No mixes here yet. Save a link above, or add a saved mix to this collection.',
                        ],
                      )
                    : h.empty,
                ],
              ),
            ],
          )
        : h.empty,
      !page.workspace
        ? h.div(
            [h.Class(directory ? 'grid gap-4 sm:grid-cols-2' : 'mx-auto grid max-w-3xl gap-5')],
            directory
              ? [
                  ...page.document.collections.map((item) =>
                    h.a(
                      [
                        h.Href(`/collections/${item.id}`),
                        h.Class(`${panel} block hover:border-highlight`),
                      ],
                      [
                        h.p([h.Class('mb-3 text-xs text-highlight')], [item.ownerName]),
                        h.h2([h.Class('text-xl font-bold')], [item.title]),
                        h.p(
                          [h.Class('mt-3 text-sm leading-6 text-muted-foreground')],
                          [item.description],
                        ),
                      ],
                    ),
                  ),
                  page.document.collections.length === 0 && !page.error
                    ? h.p(
                        [h.Class('text-sm text-muted-foreground')],
                        ['No public collections yet. Start one from your listening pile.'],
                      )
                    : h.empty,
                ]
              : [
                  ...mixes.map((mix) => mixCard(mix, page)),
                  mixes.length === 0 && !page.error
                    ? h.p(
                        [h.Class('text-sm text-muted-foreground')],
                        ['No published mixes in this collection yet.'],
                      )
                    : h.empty,
                ],
          )
        : h.empty,
    ],
  )
}
