import { GetAllShowsResponse, GetShowEpisodesResponse } from '@gbfm/api/shows'
import { Schema } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { artwork } from './artwork'
import { formatDate } from './format-date'
import { iconPaths, lucide } from './icons'
import { episodeRowsSkeleton } from './skeletons'

/** The public show browser preserves selection in the URL and distinguishes failed episode reads from empty shows. */
export const ShowsDocument = Schema.Struct({
  shows: GetAllShowsResponse.fields.data,
  selectedSlug: Schema.NullOr(Schema.String),
  episodes: Schema.NullOr(GetShowEpisodesResponse),
})

export type ShowsDocument = typeof ShowsDocument.Type

export type Episode = (typeof GetShowEpisodesResponse.Type.data)[number]

type Show = ShowsDocument['shows'][number]

export type ShowsPlayback<M> = {
  readonly play: (episode: Episode) => M
  readonly toggle: M
  readonly currentId: string | null
  readonly isPlaying: boolean
}

const hostLine = (show: Show) => show.hosts.map((host) => host.name).join(', ')

const showHref = (show: Show) => `/shows/${encodeURIComponent(show.slug)}`

const mixHref = (episode: Episode) => `/mixes/${encodeURIComponent(episode.slug)}`

const dial = <M>(h: HtmlBuilder<M>, shows: ReadonlyArray<Show>, selectedSlug: string | null) =>
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
          ...(current ? [h.AriaCurrent('page')] : []),
          h.Class(
            `-mb-px flex shrink-0 items-center gap-3 border-b-2 py-3 pr-5 no-underline transition-colors ${
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
        '(min-width: 640px) 224px, 60vw',
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
                  h.span([h.Class('font-semibold text-foreground')], [hostLine(show)]),
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
            [h.Class('mt-6 flex flex-wrap items-center gap-3')],
            [latest ? latestButton(h, latest, playback, interactive, false) : h.empty, actions],
          ),
        ],
      ),
    ],
  )
}

const equalizer = <M>(h: HtmlBuilder<M>) =>
  h.span(
    [h.AriaHidden(true), h.Class('flex h-4 items-end gap-[3px]')],
    ['0ms', '160ms', '320ms'].map((delay) =>
      h.span(
        [
          h.Key(delay),
          h.Class(
            'h-full w-[3px] origin-bottom bg-highlight motion-safe:animate-[equalizer_900ms_ease-in-out_infinite]',
          ),
          h.Style({ animationDelay: delay }),
        ],
        [],
      ),
    ),
  )

/** The episode number doubles as its play control: hover or focus swaps it for play or pause, playback shows the equalizer. */
const episodePlay = <M>(
  h: HtmlBuilder<M>,
  episode: Episode,
  number: number,
  playback: ShowsPlayback<M>,
  interactive: boolean,
) => {
  const current = episode.id === playback.currentId
  const playing = current && playback.isPlaying
  const reveal = 'group-hover/play:opacity-100 group-focus-visible/play:opacity-100'
  const conceal = 'group-hover/play:opacity-0 group-focus-visible/play:opacity-0'

  return h.button(
    [
      h.Type('button'),
      h.Disabled(!interactive),
      h.OnClick(current ? playback.toggle : playback.play(episode)),
      h.AriaLabel(`${playing ? 'Pause' : 'Play'} episode ${number}: ${episode.title}`),
      h.AriaPressed(String(playing)),
      h.Class(
        'group/play relative -m-1 grid place-items-center rounded-sm border-0 bg-transparent p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
      ),
    ],
    [
      h.span(
        [
          h.AriaHidden(true),
          h.Class(
            `col-start-1 row-start-1 w-[3ch] text-2xl font-black tabular-nums tracking-tighter transition-opacity duration-150 sm:text-4xl ${conceal} ${
              playing ? 'opacity-0' : ''
            } ${current ? 'text-highlight' : 'episode-tune text-muted-foreground/40'}`,
          ),
        ],
        [String(number).padStart(3, '0')],
      ),
      playing
        ? h.span(
            [
              h.AriaHidden(true),
              h.Class(`col-start-1 row-start-1 transition-opacity duration-150 ${conceal}`),
            ],
            [equalizer(h)],
          )
        : h.empty,
      h.span(
        [
          h.AriaHidden(true),
          h.Class(
            `col-start-1 row-start-1 flex h-10 w-10 scale-75 items-center justify-center rounded-sm bg-highlight text-highlight-foreground opacity-0 shadow-lg transition duration-150 group-hover/play:scale-100 group-focus-visible/play:scale-100 ${reveal}`,
          ),
        ],
        [lucide(playing ? iconPaths.pause : iconPaths.play, 'h-4 w-4 fill-current')],
      ),
      playing
        ? h.empty
        : h.span(
            [
              h.AriaHidden(true),
              h.Class(
                'pointer-events-none absolute -left-1 top-0 hidden text-muted-foreground pointer-coarse:block',
              ),
            ],
            [lucide(iconPaths.play, 'h-2.5 w-2.5 fill-current')],
          ),
    ],
  )
}

const episodeRow = <M>(
  h: HtmlBuilder<M>,
  episode: Episode,
  number: number,
  playback: ShowsPlayback<M>,
  interactive: boolean,
) => {
  const current = episode.id === playback.currentId

  return h.li(
    [
      h.Key(episode.id),
      h.Class(
        `episode-reveal group relative m-0 grid list-none grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 border-b border-border py-5 sm:grid-cols-[auto_4rem_minmax(0,1fr)_auto] sm:gap-x-6 ${
          current
            ? 'before:absolute before:inset-y-0 before:-left-4 before:w-[3px] before:bg-highlight'
            : ''
        }`,
      ),
    ],
    [
      episodePlay(h, episode, number, playback, interactive),
      h.a(
        [h.Href(mixHref(episode)), h.Tabindex(-1), h.AriaHidden(true), h.Class('hidden sm:block')],
        [artwork(episode.thumbnailUrl, '', '64px', false, 'h-16 w-16 rounded-sm')],
      ),
      h.div(
        [h.Class('min-w-0')],
        [
          h.h3(
            [h.Class('m-0 text-base font-bold leading-snug')],
            [
              h.a(
                [
                  h.Href(mixHref(episode)),
                  h.Class(
                    `no-underline hover:underline ${current ? 'text-highlight' : 'text-foreground'}`,
                  ),
                ],
                [episode.title],
              ),
            ],
          ),
          h.p(
            [h.Class('mt-1 flex items-center gap-3 text-xs text-muted-foreground sm:hidden')],
            [h.time([h.Datetime(episode.createdAt)], [formatDate(episode.createdAt)])],
          ),
          episode.description
            ? h.p(
                [h.Class('mt-1 line-clamp-2 max-w-prose text-sm text-muted-foreground')],
                [episode.description],
              )
            : h.empty,
        ],
      ),
      h.div(
        [h.Class('hidden text-right text-xs text-muted-foreground sm:block')],
        [
          h.time(
            [h.Datetime(episode.createdAt), h.Class('block')],
            [formatDate(episode.createdAt)],
          ),
          episode.playCount > 0
            ? h.span(
                [h.Class('block')],
                [`${episode.playCount} ${episode.playCount === 1 ? 'play' : 'plays'}`],
              )
            : h.empty,
        ],
      ),
    ],
  )
}

const episodeList = <M>(
  h: HtmlBuilder<M>,
  document: ShowsDocument,
  playback: ShowsPlayback<M>,
  interactive: boolean,
) => {
  if (!document.episodes)
    return h.p(
      [h.Role('alert'), h.Class('py-8 text-sm text-muted-foreground')],
      ['Episodes are unavailable right now. Reload the page to try again.'],
    )

  const episodes = document.episodes.data

  if (!episodes.length)
    return h.p([h.Class('py-8 text-sm text-muted-foreground')], ['No episodes yet.'])

  const total = Math.max(document.episodes.pagination.total, episodes.length)

  return h.ol(
    [h.Class('m-0 list-none border-t border-border p-0')],
    episodes.map((episode, index) =>
      episodeRow(h, episode, episode.episodeNumber ?? total - index, playback, interactive),
    ),
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
      dial(h, document.shows, document.selectedSlug),
      selected
        ? h.div(
            [h.Key(selected.id), h.Class('show-scope animate-in fade-in duration-300')],
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
