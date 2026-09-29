import type { HtmlBuilder } from 'foldkit/html'

import { artwork } from '../../view/artwork'
import { formatDate } from '../../view/format-date'
import { iconPaths, lucide } from '../../view/icons'
import type { Episode, ShowsDocument, ShowsPlayback } from './document'

const episodeArtSizes = '64px'

const mixHref = (episode: Episode) => `/mixes/${encodeURIComponent(episode.slug)}`

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
        [artwork(episode.thumbnailUrl, '', episodeArtSizes, false, 'h-16 w-16 rounded-sm')],
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

export const episodeList = <M>(
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
