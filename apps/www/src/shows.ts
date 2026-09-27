import { GetAllShowsResponse, GetShowEpisodesResponse } from '@gbfm/api/shows'
import { Schema } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { artwork } from './artwork'

/** The public show browser preserves selection in the URL and distinguishes failed episode reads from empty shows. */
export const ShowsDocument = Schema.Struct({
  shows: GetAllShowsResponse.fields.data,
  selectedSlug: Schema.NullOr(Schema.String),
  episodes: Schema.NullOr(GetShowEpisodesResponse),
})

export type ShowsDocument = typeof ShowsDocument.Type

export type Episode = (typeof GetShowEpisodesResponse.Type.data)[number]

/** Three-column show, episodes, switcher layout collapses to a horizontal switcher on narrow screens. */
export const showsView = <M>(
  document: ShowsDocument,
  h: HtmlBuilder<M>,
  play: (episode: Episode) => M,
  actions: Html,
  interactive: boolean,
) => {
  const selected = document.shows.find((show) => show.slug === document.selectedSlug)

  if (!document.shows.length)
    return h.section([h.Class('page')], [h.h1([], ['Radio Shows']), h.p([], ['No shows found'])])

  return h.div(
    [h.Class('shows-browser')],
    [
      h.aside(
        [h.Class('show-meta')],
        selected
          ? [
              h.h2([], ['Show']),
              artwork(
                selected.thumbnailUrl,
                selected.title,
                '(max-width: 1023px) 200px, 220px',
                true,
              ),
              h.h1([], [selected.title]),
              h.p([], [`hosted by ${selected.hosts.map((host) => host.name).join(', ')}`]),
              actions,
              selected.description
                ? h.p([h.Class('content-paragraph')], [selected.description])
                : h.empty,
            ]
          : [h.p([], ['Select a show to browse its mixes'])],
      ),
      h.section(
        [h.Class('show-episodes')],
        [
          h.h2([], ['Episodes']),
          !selected
            ? h.empty
            : !document.episodes
              ? h.p([h.Role('alert')], ['Episodes are unavailable right now. Please try again.'])
              : !document.episodes.data.length
                ? h.p([], ['No episodes yet.'])
                : h.div(
                    [],
                    document.episodes.data.map((episode) =>
                      h.article(
                        [h.Class('episode-row'), h.Key(episode.id)],
                        [
                          h.a(
                            [h.Href(`/mixes/${encodeURIComponent(episode.slug)}`)],
                            [artwork(episode.thumbnailUrl, '', '(max-width: 640px) 80px, 112px')],
                          ),
                          h.div(
                            [],
                            [
                              h.a(
                                [h.Href(`/mixes/${encodeURIComponent(episode.slug)}`)],
                                [h.h3([], [episode.title])],
                              ),
                              h.time(
                                [h.Datetime(episode.createdAt)],
                                [
                                  new Date(episode.createdAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    timeZone: 'UTC',
                                  }),
                                ],
                              ),
                              episode.description ? h.p([], [episode.description]) : h.empty,
                              h.button(
                                [
                                  h.Disabled(!interactive),
                                  h.OnClick(play(episode)),
                                  h.AriaLabel(`Play ${episode.title}`),
                                ],
                                ['▶ Play'],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
        ],
      ),
      h.aside(
        [h.Class('show-switcher')],
        [
          h.h2([], ['All shows']),
          h.nav(
            [h.AriaLabel('Shows')],
            document.shows.map((show) =>
              h.a(
                [
                  h.Href(`/shows/${encodeURIComponent(show.slug)}`),
                  h.AriaCurrent(show.slug === document.selectedSlug ? 'page' : 'false'),
                ],
                [artwork(show.thumbnailUrl, '', '48px'), h.span([], [show.title])],
              ),
            ),
          ),
        ],
      ),
    ],
  )
}
