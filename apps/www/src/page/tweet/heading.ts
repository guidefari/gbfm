import { inertHtml as h } from 'foldkit/html'

import { breadcrumbs, crumbCurrent, crumbLink } from '../../view/breadcrumbs'
import { monthLabel, monthOf, relativeAge } from './timeline'

export const tweetHeading = (at: string, now: number) =>
  h.div(
    [h.Class('mb-6 flex min-h-7 items-center gap-3 text-xs')],
    [
      breadcrumbs([
        crumbLink({ label: 'Tweets', href: '/tweets' }),
        crumbCurrent(monthLabel(monthOf(at))),
      ]),
      h.span([h.Class('ml-auto shrink-0 text-muted-foreground')], [relativeAge(at, now)]),
    ],
  )
