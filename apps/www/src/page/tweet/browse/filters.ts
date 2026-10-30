import { browseMonthLabel } from '@gbfm/core/tweet-browse'
import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../../message'
import type { TweetBrowseDocument } from './document'

export const browseFilters = (h: HtmlBuilder<Message>, data: TweetBrowseDocument) => {
  const years = [...new Set(data.timeline.map((entry) => entry.month.slice(0, 4)))]

  return h.div(
    [h.Class('tweet-browse-toolbar')],
    [
      h.form(
        [h.Method('get'), h.Action('/tweets'), h.Class('tweet-date-form')],
        [
          h.input([h.Type('hidden'), h.Name('q'), h.Value('archive')]),
          h.label([h.For('tweet-browse-month')], ['Date']),
          h.select(
            [h.Id('tweet-browse-month'), h.Name('month'), h.AriaLabel('Browse by date')],
            [
              h.option([h.Value(''), h.Selected(data.month === null)], ['All dates']),
              ...years.map((year) =>
                h.optgroup(
                  [h.Attribute('label', year)],
                  data.timeline.flatMap((entry) =>
                    entry.month.startsWith(year)
                      ? [
                          h.option(
                            [h.Value(entry.month), h.Selected(entry.month === data.month)],
                            [`${browseMonthLabel(entry.month)} · ${entry.total} tweets`],
                          ),
                        ]
                      : [],
                  ),
                ),
              ),
            ],
          ),
          h.button([h.Type('submit'), h.Class('btn')], ['Apply']),
        ],
      ),
      h.p([], [`${data.total} ${data.total === 1 ? 'tweet' : 'tweets'} · newest first`]),
      !data.datesAvailable
        ? h.p(
            [h.Role('status')],
            ['Date filters are unavailable. You can still browse recent tweets.'],
          )
        : h.empty,
    ],
  )
}
