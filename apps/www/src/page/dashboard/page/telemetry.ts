import type { AdminTelemetryResponse } from '@gbfm/api/admin'
import { Match } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'

import { Message } from '../message'
import { dataTable, emptyState, pageHeader, relativeTime } from '../ui'

/** CLS is a unitless score; other available percentiles are durations. */
export const telemetryP75 = (section: string, name: string, value: number | null) => {
  if (value === null) return 'n/a'

  if (section === 'webVitals' && name.toLowerCase() === 'cls')
    return value.toLocaleString('en-US', { maximumFractionDigits: 3 })

  return `${Math.round(value).toLocaleString('en-US')} ms`
}

const sections: ReadonlyArray<{
  readonly key: keyof AdminTelemetryResponse['sections']
  readonly label: string
}> = [
  { key: 'webVitals', label: 'Web vitals' },
  { key: 'navigation', label: 'Navigation' },
  { key: 'errors', label: 'Errors' },
  { key: 'player', label: 'Player' },
]

const columns = [
  { label: 'Event' },
  { label: 'Route', className: 'admin-col-mono' },
  { label: 'Release', className: 'admin-col-muted' },
  { label: 'Browser', className: 'admin-col-muted' },
  { label: 'Samples' },
  { label: 'p75' },
]

const stateNotice = (h: HtmlBuilder<Message>, data: AdminTelemetryResponse) =>
  Match.value(data.state).pipe(
    Match.when('partial', () =>
      h.p(
        [h.Role('status'), h.Class('admin-notice')],
        ['Some telemetry queries are unavailable. Available sections remain current.'],
      ),
    ),
    Match.when('empty', () =>
      h.p(
        [h.Class('admin-notice')],
        [`No sampled browser telemetry was recorded in the last ${data.windowHours} hours.`],
      ),
    ),
    Match.when('complete', () => h.empty),
    Match.exhaustive,
  )

/** Preserve query availability independently of row count, including partially available dashboards. */
export const telemetryView = (h: HtmlBuilder<Message>, data: AdminTelemetryResponse | undefined) =>
  h.section(
    [h.Class('admin-page telemetry-dashboard'), h.AriaLabel('Browser and player health')],
    [
      pageHeader(h, 'Sampled browser and player health from real visits.', [
        h.button(
          [h.Class('admin-button-small'), h.OnClick(Message.LoadRequested())],
          ['Refresh telemetry'],
        ),
      ]),
      !data
        ? h.p([h.Role('alert')], ['Telemetry could not be loaded.'])
        : h.div(
            [h.Class('admin-page')],
            [
              h.p(
                [h.Class('admin-description')],
                [
                  `Last ${data.windowHours} hours, generated `,
                  relativeTime(h, data.generatedAt),
                  `. ${data.retentionNotice}`,
                ],
              ),
              stateNotice(h, data),
              h.div(
                [h.Class('telemetry-sections')],
                sections.map(({ key, label }) => {
                  const section = data.sections[key]

                  return h.article(
                    [h.Key(key), h.AriaLabel(label), h.Class('admin-frame')],
                    [
                      h.h3([], [label]),
                      !section.available
                        ? emptyState(h, 'Unavailable')
                        : dataTable(h, {
                            label,
                            columns,
                            rows: section.rows.map((row, index) => ({
                              key: `${row.name}-${row.route}-${row.release}-${row.browser}-${index}`,
                              cells: [
                                row.name,
                                row.route,
                                row.release,
                                row.browser,
                                row.samples.toLocaleString('en-US'),
                                telemetryP75(key, row.name, row.p75),
                              ],
                            })),
                            empty: emptyState(h, 'No events in this window.'),
                          }),
                    ],
                  )
                }),
              ),
            ],
          ),
    ],
  )
