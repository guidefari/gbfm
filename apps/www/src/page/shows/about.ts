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
        'fixed inset-0 m-auto h-fit max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-sm border border-border bg-background p-6 text-foreground shadow-2xl backdrop:bg-background/80 backdrop:backdrop-blur-sm sm:p-10',
      ),
    ],
    [
      h.div(
        [h.Class('mb-6 flex items-start justify-between gap-4')],
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
                'grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border bg-transparent text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              ),
            ],
            [lucide(iconPaths.close, 'h-4 w-4')],
          ),
        ],
      ),
      h.div([h.Class('max-w-prose')], [richContentView(document, h)]),
    ],
  )

export const about = <M>(h: HtmlBuilder<M>, title: string, document: RichContentDocument) =>
  h.aside(
    [
      h.AriaLabel('About the show'),
      h.Class(
        'mb-6 border-t border-border pt-5 lg:col-start-2 lg:row-start-1 lg:mb-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0',
      ),
    ],
    [
      h.h2([h.Class('mb-3 text-lg font-bold')], ['About the show']),
      h.div([h.Class(`${compactProse} [&_p]:line-clamp-5`)], [richContentView(blurb(document), h)]),
      h.button(
        [
          h.Type('button'),
          h.Attribute('popovertarget', panelId),
          h.Class(
            'mt-1 inline-flex items-center gap-1 rounded-sm border-0 bg-transparent p-0 text-sm font-semibold text-highlight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ),
        ],
        ['Read more', lucide(iconPaths.chevronRight, 'h-4 w-4')],
      ),
      panel(h, title, document),
    ],
  )
