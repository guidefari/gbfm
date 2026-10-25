import type { RichContentDocument } from '@gbfm/rich-content/schema'
import type { HtmlBuilder } from 'foldkit/html'

import { iconPaths, lucide } from '../../view/icons'
import { richContentView } from '../../view/rich-content/render'

const panelId = 'show-about-panel'

const compactProse =
  'text-foreground/80 [&_.rich-content>*]:my-3 [&_.rich-content>:first-child]:mt-0 [&_li]:text-sm [&_li]:leading-relaxed [&_p]:text-sm [&_p]:leading-relaxed'

const blurb = (document: RichContentDocument): RichContentDocument => ({
  ...document,
  blocks: document.blocks.slice(0, 1),
})

/** Native popover so the full write-up opens before hydration without model state. */
const panel = <M>(h: HtmlBuilder<M>, title: string, document: RichContentDocument) =>
  h.div(
    [
      h.Id(panelId),
      h.Attribute('popover', ''),
      h.AriaLabel(`About ${title}`),
      h.Class(
        [
          'fixed inset-0 m-auto h-fit max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden rounded-sm border border-border bg-background p-0 text-foreground shadow-2xl open:flex',
          'translate-y-4 scale-[0.98] opacity-0 transition-[opacity,translate,scale,display,overlay] duration-200 ease-out transition-discrete open:translate-y-0 open:scale-100 open:opacity-100 starting:open:translate-y-4 starting:open:scale-[0.98] starting:open:opacity-0',
          'backdrop:bg-transparent backdrop:transition-[background-color,backdrop-filter,display,overlay] backdrop:duration-200 backdrop:transition-discrete open:backdrop:bg-background/80 open:backdrop:backdrop-blur-sm starting:open:backdrop:bg-transparent starting:open:backdrop:backdrop-blur-none',
          'motion-reduce:transition-none motion-reduce:backdrop:transition-none',
        ].join(' '),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            'flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4 sm:px-10 sm:py-5',
          ),
        ],
        [
          h.div(
            [],
            [
              h.p([h.Class('m-0 text-xs text-muted-foreground')], ['About the show']),
              h.h2([h.Class('m-0 mt-1 text-3xl font-black leading-none tracking-tight')], [title]),
            ],
          ),
          h.button(
            [
              h.Type('button'),
              h.Attribute('popovertarget', panelId),
              h.Attribute('popovertargetaction', 'hide'),
              h.AriaLabel('Close'),
              h.Class(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border bg-transparent p-0 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              ),
            ],
            [lucide(iconPaths.close, 'block h-4 w-4')],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            'min-h-0 overflow-y-auto overscroll-contain px-6 py-6 sm:px-10 sm:py-8 [&_.rich-content>:first-child]:mt-0',
          ),
        ],
        [h.div([h.Class('max-w-prose')], [richContentView(document, h)])],
      ),
    ],
  )

export const about = <M>(h: HtmlBuilder<M>, title: string, document: RichContentDocument) =>
  h.div(
    [h.Class('mt-4 max-w-prose')],
    [
      h.div(
        [h.Class(`${compactProse} [&_.rich-content>*]:my-0 [&_p]:line-clamp-3`)],
        [richContentView(blurb(document), h)],
      ),
      h.button(
        [
          h.Type('button'),
          h.Attribute('popovertarget', panelId),
          h.Class(
            'mt-2 inline-flex items-center gap-0.5 rounded-sm border-0 bg-transparent p-0 text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ),
        ],
        ['Read more', lucide(iconPaths.chevronRight, 'h-3.5 w-3.5')],
      ),
      panel(h, title, document),
    ],
  )
