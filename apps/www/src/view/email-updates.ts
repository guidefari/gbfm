import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from '../message'
import { iconPaths, lucide } from './icons'

/** A quiet end-of-content pointer to the dedicated subscribe page, never an inline form. */
export const emailUpdatesInvite = (h: HtmlBuilder<Message>) =>
  h.aside(
    [
      h.AriaLabel('Email updates'),
      h.Class(
        'mt-16 flex max-w-prose flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between',
      ),
    ],
    [
      h.div(
        [h.Class('min-w-0')],
        [
          h.p([h.Class('m-0 text-sm font-semibold text-foreground')], ['Email updates']),
          h.p(
            [h.Class('m-0 mt-1 text-sm text-muted-foreground')],
            ['New mixes, notable drops, and occasional news. Free, no account needed.'],
          ),
        ],
      ),
      h.a(
        [
          h.Href('/subscribe'),
          h.Class(
            'inline-flex shrink-0 items-center gap-2 self-start border border-border px-3 py-2 text-sm font-semibold text-foreground no-underline transition-colors hover:border-highlight hover:text-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto',
          ),
        ],
        [lucide(iconPaths.mail, 'h-4 w-4'), 'Get email updates'],
      ),
    ],
  )
