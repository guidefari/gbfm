import type { Html, HtmlBuilder } from 'foldkit/html'

import { artwork } from '../view/artwork'
import { iconPaths, lucide } from '../view/icons'
import { episodeRowsSkeleton } from '../view/skeletons'
import type { Episode, ShowsDocument, ShowsPlayback } from './document'
import { episodeList } from './episodes'

type Show = ShowsDocument['shows'][number]

const mastheadArtSizes = '(min-width: 640px) 224px, 60vw'

const hostLine = (show: Show) => show.hosts.map((host) => host.name).join(', ')

const showHref = (show: Show) => `/shows/${encodeURIComponent(show.slug)}`

const dial = <M>(
  h: HtmlBuilder<M>,
  shows: ReadonlyArray<Show>,
  selectedSlug: string | null,
  prefetch: (href: string) => M,
) =>
  h.nav(
    [
      h.AriaLabel('Shows'),
      h.Class(
        '-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 no-scrollbar sm:mx-0 sm:px-0',
      ),
    ],
    shows.map((show) => {
      const current = show.slug === selectedSlug

      return h.a(
        [
          h.Key(show.id),
          h.Href(showHref(show)),
          ...(current
            ? [h.AriaCurrent('page')]
            : [h.OnMouseEnter(prefetch(showHref(show))), h.OnFocus(prefetch(showHref(show)))]),
          h.Class(
            `-mb-px flex shrink-0 items-center gap-3 border-b-2 py-3 pr-5 no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
              current
                ? 'border-highlight text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`,
          ),
        ],
        [
          artwork(show.thumbnailUrl, '', '40px', false, 'h-10 w-10 shrink-0 rounded-sm'),
          h.span(
            [h.Class('flex min-w-0 flex-col leading-tight')],
            [
              h.span([h.Class('truncate text-sm font-bold')], [show.title]),
              h.span([h.Class('truncate text-xs text-muted-foreground')], [hostLine(show)]),
            ],
          ),
        ],
      )
    }),
  )

const primaryButton =
  'inline-flex h-10 items-center gap-2 rounded-sm border-0 bg-highlight px-4 text-sm font-bold text-highlight-foreground transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

const latestButton = <M>(
  h: HtmlBuilder<M>,
  latest: Episode,
  playback: ShowsPlayback<M>,
  interactive: boolean,
  compact: boolean,
) => {
  const isCurrent = latest.id === playback.currentId
  const playing = isCurrent && playback.isPlaying
  const label = isCurrent ? (playback.isPlaying ? 'Pause' : 'Resume') : 'Play latest'

  return h.button(
    [
      h.Type('button'),
      h.Disabled(!interactive),
      h.OnClick(isCurrent ? playback.toggle : playback.play(latest)),
      ...(compact ? [h.AriaLabel(label), h.Title(label)] : []),
      h.Class(compact ? `${primaryButton} h-9 px-3` : primaryButton),
    ],
    [
      lucide(playing ? iconPaths.pause : iconPaths.play, 'h-4 w-4 fill-current'),
      compact ? h.span([h.Class('hidden sm:inline')], [label]) : label,
    ],
  )
}

/** Folds out of the masthead as it scrolls away; hidden where scroll timelines are unsupported. */
const compactBar = <M>(
  h: HtmlBuilder<M>,
  show: Show,
  latest: Episode | null,
  playback: ShowsPlayback<M>,
  interactive: boolean,
) =>
  h.div(
    [h.Class('sticky top-0 z-30 h-0')],
    [
      h.div(
        [
          h.Class(
            'show-compact absolute inset-x-0 top-0 -mx-4 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md',
          ),
        ],
        [
          artwork(show.thumbnailUrl, '', '40px', false, 'h-10 w-10 shrink-0 rounded-sm shadow-md'),
          h.div(
            [h.Class('min-w-0 flex-1 leading-tight')],
            [
              h.p([h.Class('m-0 truncate text-base font-black tracking-tight')], [show.title]),
              show.hosts.length
                ? h.p([h.Class('m-0 truncate text-xs text-muted-foreground')], [hostLine(show)])
                : h.empty,
            ],
          ),
          latest ? latestButton(h, latest, playback, interactive, true) : h.empty,
        ],
      ),
    ],
  )

const masthead = <M>(
  h: HtmlBuilder<M>,
  show: Show,
  latest: Episode | null,
  playback: ShowsPlayback<M>,
  actions: Html,
  interactive: boolean,
) => {
  return h.header(
    [
      h.Class(
        'show-masthead grid gap-6 py-8 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-end sm:gap-10 sm:py-12',
      ),
    ],
    [
      artwork(
        show.thumbnailUrl,
        show.title,
        mastheadArtSizes,
        true,
        'show-masthead-art w-3/5 max-w-56 rounded-sm shadow-2xl sm:w-full sm:max-w-none',
      ),
      h.div(
        [h.Class('show-masthead-copy min-w-0')],
        [
          h.h1(
            [
              h.Class(
                'm-0 break-words text-[clamp(2.5rem,7vw,5.5rem)] font-black leading-[0.9] tracking-tighter text-foreground',
              ),
            ],
            [show.title],
          ),
          show.hosts.length
            ? h.p(
                [h.Class('mt-4 text-sm text-muted-foreground')],
                [
                  'hosted by ',
                  ...show.hosts.flatMap((host, index) => [
                    host.username
                      ? h.a(
                          [
                            h.Key(host.id),
                            h.Href(`/profile/${encodeURIComponent(host.username)}`),
                            h.Class(
                              'font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-highlight hover:decoration-highlight',
                            ),
                          ],
                          [host.name],
                        )
                      : h.span(
                          [h.Key(host.id), h.Class('font-semibold text-foreground')],
                          [host.name],
                        ),
                    index < show.hosts.length - 1 ? ', ' : '',
                  ]),
                ],
              )
            : h.empty,
          show.description
            ? h.p(
                [h.Class('mt-4 max-w-prose text-base leading-relaxed text-foreground/80')],
                [show.description],
              )
            : h.empty,
          h.div(
            [h.Class('mt-6 flex min-h-10 flex-wrap items-center gap-3')],
            [latest ? latestButton(h, latest, playback, interactive, false) : h.empty, actions],
          ),
        ],
      ),
    ],
  )
}

export const showsView = <M>(
  document: ShowsDocument,
  h: HtmlBuilder<M>,
  playback: ShowsPlayback<M>,
  actions: Html,
  interactive: boolean,
  pending = false,
) => {
  const selected = document.shows.find((show) => show.slug === document.selectedSlug)

  if (!document.shows.length)
    return h.div(
      [h.Class('mx-auto max-w-5xl px-4 py-16')],
      [
        h.h1([h.Class('m-0 text-3xl font-black tracking-tight')], ['Radio shows']),
        h.p([h.Class('mt-4 text-muted-foreground')], ['No shows are on air yet.']),
      ],
    )

  return h.div(
    [h.Class('mx-auto max-w-5xl px-4 pb-16 pt-4 sm:pt-6')],
    [
      dial(h, document.shows, document.selectedSlug, playback.prefetch),
      selected
        ? h.div(
            [h.Key(selected.id), h.Class('show-scope')],
            [
              compactBar(
                h,
                selected,
                pending ? null : (document.episodes?.data[0] ?? null),
                playback,
                interactive,
              ),
              masthead(
                h,
                selected,
                pending ? null : (document.episodes?.data[0] ?? null),
                playback,
                pending ? h.empty : actions,
                interactive,
              ),
              h.section(
                [h.AriaLabel('Episodes')],
                [pending ? episodeRowsSkeleton() : episodeList(h, document, playback, interactive)],
              ),
            ],
          )
        : h.p([h.Class('py-12 text-muted-foreground')], ['Choose a show to see its episodes.']),
    ],
  )
}
