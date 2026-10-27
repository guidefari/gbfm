import type { HtmlBuilder } from 'foldkit/html'

import { artwork } from './artwork'
import { iconPaths, lucide } from './icons'

export type NowPlaying = {
  readonly title: string
  readonly thumbnailUrl: string | null
  readonly isPlaying: boolean
  readonly progress: number
}

export const mobilePlayer = <M>(
  h: HtmlBuilder<M>,
  current: NowPlaying | null,
  queueResolved: boolean,
  openPlayer: M,
  togglePlay: M,
) => {
  if (!current && queueResolved) return h.empty

  return h.section(
    [
      h.AriaLabel('Mini player'),
      h.Class(
        `relative flex h-16 items-center gap-3 border-b border-border px-4 ${current ? 'mobile-player' : 'mobile-player-pending'}`,
      ),
    ],
    [
      h.button(
        [
          h.Type('button'),
          h.AriaLabel('Now playing'),
          h.Disabled(!current),
          h.OnClick(openPlayer),
          h.Class(
            'flex h-full min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-0 text-left text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ),
        ],
        [
          current
            ? artwork(current.thumbnailUrl, '', '40px', false, 'size-10 shrink-0 object-cover')
            : h.span([
                h.Class(
                  'size-10 shrink-0 bg-muted bg-cover bg-center [background-image:var(--queued-art)]',
                ),
              ]),
          h.span(
            [h.Class('min-w-0 flex-1')],
            [
              h.span(
                [h.Class('block truncate text-xs font-bold')],
                [current?.title ?? 'Now playing'],
              ),
              h.span(
                [h.Class('block text-[11px] text-muted-foreground')],
                [current?.isPlaying ? 'Playing' : 'Paused'],
              ),
            ],
          ),
          lucide(iconPaths.chevronRight, 'size-4 shrink-0 -rotate-90 text-muted-foreground'),
        ],
      ),
      h.button(
        [
          h.Type('button'),
          h.AriaLabel(current?.isPlaying ? 'Pause' : 'Play'),
          h.Disabled(!current),
          h.OnClick(togglePlay),
          h.Class(
            'flex size-11 shrink-0 items-center justify-center border-0 bg-highlight text-highlight-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
          ),
        ],
        [lucide(current?.isPlaying ? iconPaths.pause : iconPaths.play, 'size-5 fill-current')],
      ),
      current
        ? h.div(
            [h.AriaHidden(true), h.Class('absolute inset-x-0 bottom-0 h-0.5 bg-border')],
            [
              h.div(
                [h.Class('h-full bg-highlight'), h.Style({ width: `${current.progress}%` })],
                [],
              ),
            ],
          )
        : h.empty,
    ],
  )
}
