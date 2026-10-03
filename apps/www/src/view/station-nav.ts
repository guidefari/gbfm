import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Principal } from '../model'
import { artworkUrl } from './artwork'
import { iconPaths, lucide } from './icons'

type NowPlaying = {
  readonly title: string
  readonly thumbnailUrl: string | null
  readonly isPlaying: boolean
  readonly progress: number
}

export type StationNavProps<M> = {
  readonly pathname: string
  readonly links: ReadonlyArray<readonly [string, string]>
  readonly principal: Principal | null
  readonly accountMenu: Html
  readonly interactive: boolean
  readonly menuOpen: boolean
  readonly nowPlaying: NowPlaying | null
  readonly togglePlay: M
  readonly openPlayer: M
  readonly openSearch: M
  readonly toggleMenu: M
}

const fallbackArtwork = 'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const desktopLinkClass = `shrink-0 rounded-sm px-2 py-1 text-xs font-semibold tracking-wide no-underline transition-colors text-muted-foreground hover:text-foreground aria-[current=page]:text-highlight ${focusRing}`

const tabClass =
  'relative flex h-full min-w-0 flex-1 items-center justify-center border-0 bg-transparent p-0 no-underline text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-[current=page]:text-highlight'

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

const playIcon = (isPlaying: boolean, className: string) =>
  lucide(isPlaying ? iconPaths.pause : iconPaths.play, `${className} fill-current`)

export const stationNav = <M>(h: HtmlBuilder<M>, props: StationNavProps<M>) => {
  const { nowPlaying } = props

  const desktop = h.div(
    [
      h.Class(
        'fixed inset-x-0 bottom-0 z-40 hidden h-12 shrink-0 items-center gap-4 border-t-2 border-foreground bg-background/95 pl-4 pr-6 backdrop-blur lg:flex',
      ),
    ],
    [
      nowPlaying
        ? h.div(
            [h.Class('absolute inset-x-0 top-0 h-[3px] bg-border/60')],
            [
              h.div(
                [
                  h.Class(
                    'h-full bg-highlight shadow-[0_0_6px_var(--highlight)] transition-[width] duration-300 ease-linear',
                  ),
                  h.Style({ width: `${nowPlaying.progress}%` }),
                ],
                [],
              ),
            ],
          )
        : h.empty,
      h.a(
        [
          h.Href('/'),
          h.AriaLabel('goosebumps.fm home'),
          h.Class(
            'group flex shrink-0 items-center text-foreground no-underline transition-colors hover:text-highlight',
          ),
        ],
        [h.span([h.Class('wordmark'), h.AriaHidden(true)], [])],
      ),
      h.nav(
        [h.AriaLabel('Primary'), h.Class('flex shrink-0 items-center gap-1')],
        props.links.map(([href, label]) =>
          h.a(
            [
              h.Key(href),
              h.Href(href),
              h.Class(desktopLinkClass),
              ...(isActive(props.pathname, href) ? [h.AriaCurrent('page')] : []),
            ],
            [label],
          ),
        ),
      ),
      h.button(
        [
          h.Type('button'),
          h.AriaLabel('Search'),
          h.Disabled(!props.interactive),
          h.OnClick(props.openSearch),
          h.Class(
            `flex size-7 shrink-0 items-center justify-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${focusRing}`,
          ),
        ],
        [lucide(iconPaths.search, 'h-3 w-3')],
      ),
      h.div([h.Class('min-w-0 flex-1')], []),
      h.div(
        [h.Class('flex shrink-0 items-center gap-3')],
        [
          nowPlaying
            ? h.div(
                [
                  h.Class(
                    'flex min-w-0 max-w-56 shrink items-center gap-2 border-r border-border pr-3',
                  ),
                ],
                [
                  h.button(
                    [
                      h.Type('button'),
                      h.AriaLabel(nowPlaying.isPlaying ? 'Pause' : 'Play'),
                      h.OnClick(props.togglePlay),
                      h.Class(
                        `flex size-7 shrink-0 items-center justify-center rounded-sm border border-border bg-transparent p-0 text-foreground transition-colors hover:bg-muted ${focusRing}`,
                      ),
                    ],
                    [playIcon(nowPlaying.isPlaying, 'h-3.5 w-3.5')],
                  ),
                  h.button(
                    [
                      h.Type('button'),
                      h.OnClick(props.openPlayer),
                      h.Class(
                        `min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left text-xs font-medium text-muted-foreground no-underline transition-colors hover:text-foreground ${focusRing}`,
                      ),
                    ],
                    [nowPlaying.title],
                  ),
                ],
              )
            : h.empty,
          props.principal
            ? props.accountMenu
            : h.a(
                [
                  h.Href(`/auth/sign-in?returnTo=${encodeURIComponent(props.pathname)}`),
                  h.Class(
                    'shrink-0 text-xs font-semibold text-highlight no-underline hover:opacity-90',
                  ),
                ],
                ['Log in'],
              ),
        ],
      ),
    ],
  )

  const mobile = h.nav(
    [
      h.AriaLabel('Primary'),
      h.Class(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden',
      ),
    ],
    [
      h.div(
        [h.Class('grid h-11 grid-cols-5')],
        [
          nowPlaying
            ? h.button(
                [
                  h.Type('button'),
                  h.AriaLabel('Now playing'),
                  h.OnClick(props.openPlayer),
                  h.Class(`${tabClass} text-foreground`),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        'relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border',
                      ),
                    ],
                    [
                      h.img([
                        h.Src(artworkUrl(nowPlaying.thumbnailUrl || fallbackArtwork, 96)),
                        h.Alt(''),
                        h.Class('size-full object-cover'),
                      ]),
                      h.span(
                        [
                          h.Class(
                            'absolute inset-0 flex items-center justify-center bg-background/40',
                          ),
                        ],
                        [playIcon(nowPlaying.isPlaying, 'h-3 w-3 text-white')],
                      ),
                    ],
                  ),
                ],
              )
            : h.a(
                [h.Href('/shows'), h.AriaLabel('Now playing'), h.Class(tabClass)],
                [lucide(iconPaths.disc, 'h-5 w-5 [stroke-width:1.75]')],
              ),
          h.a(
            [
              h.Href('/shows'),
              h.AriaLabel('Shows'),
              h.Class(tabClass),
              ...(isActive(props.pathname, '/shows') ? [h.AriaCurrent('page')] : []),
            ],
            [lucide(iconPaths.disc, 'h-5 w-5 [stroke-width:1.75]')],
          ),
          h.a(
            [
              h.Href('/editorial'),
              h.AriaLabel('Editorial'),
              h.Class(tabClass),
              ...(isActive(props.pathname, '/editorial') ? [h.AriaCurrent('page')] : []),
            ],
            [lucide(iconPaths.book, 'h-5 w-5 [stroke-width:1.75]')],
          ),
          h.button(
            [
              h.Type('button'),
              h.AriaLabel('Search'),
              h.Disabled(!props.interactive),
              h.OnClick(props.openSearch),
              h.Class(tabClass),
            ],
            [lucide(iconPaths.search, 'h-5 w-5 [stroke-width:1.75]')],
          ),
          h.button(
            [
              h.Type('button'),
              h.AriaLabel('Menu'),
              h.Disabled(!props.interactive),
              h.AriaExpanded(props.menuOpen),
              h.AriaHasPopup('dialog'),
              h.AriaControls('mobile-menu'),
              h.OnClick(props.toggleMenu),
              h.Class(`${tabClass} ${props.menuOpen ? 'text-highlight' : ''}`),
            ],
            [lucide(iconPaths.menu, 'h-5 w-5 [stroke-width:1.75]')],
          ),
        ],
      ),
    ],
  )

  return h.div([], [desktop, mobile])
}
