import type { AdminTelemetryResponse } from '@gbfm/api/admin'
import { Match } from 'effect'
import { inertHtml as h } from 'foldkit/html'

/** CLS is a unitless score; other available percentiles are durations. */
export const telemetryP75 = (section: string, name: string, value: number | null) => {
  if (value === null) return '—'

  if (section === 'webVitals' && name.toLowerCase() === 'cls')
    return value.toLocaleString('en-US', { maximumFractionDigits: 3 })

  return `${Math.round(value).toLocaleString('en-US')} ms`
}

/** Preserve query availability independently of row count, including partially available dashboards. */
export const telemetryView = (data: AdminTelemetryResponse | undefined) =>
  h.section(
    [h.Class('dashboard-panel telemetry-dashboard'), h.AriaLabel('Browser and player health')],
    [
      h.h2([], ['Browser and player health']),
      !data
        ? h.p([h.Role('alert')], ['Telemetry could not be loaded.'])
        : h.div(
            [],
            [
              h.p([], [`Last ${data.windowHours} hours · Generated ${data.generatedAt}`]),
              h.p([], [data.retentionNotice]),
              Match.value(data.state).pipe(
                Match.when('partial', () =>
                  h.p(
                    [h.Role('status')],
                    ['Some telemetry queries are unavailable. Available sections remain current.'],
                  ),
                ),
                Match.when('empty', () =>
                  h.p(
                    [],
                    [
                      `No sampled browser telemetry was recorded in the last ${data.windowHours} hours.`,
                    ],
                  ),
                ),
                Match.when('complete', () => h.empty),
                Match.exhaustive,
              ),
              h.div(
                [h.Class('telemetry-sections')],
                Object.entries(data.sections).map(([key, section]) =>
                  h.article(
                    [h.AriaLabel(key === 'webVitals' ? 'Web vitals' : key)],
                    [
                      h.h3([], [key === 'webVitals' ? 'Web vitals' : key]),
                      !section.available
                        ? h.p([], ['Unavailable'])
                        : section.rows.length === 0
                          ? h.p([], ['No events in this window.'])
                          : h.div(
                              [],
                              section.rows.map((row) =>
                                h.dl(
                                  [],
                                  [
                                    h.dt([], ['Event']),
                                    h.dd([], [row.name]),
                                    h.dt([], ['Route']),
                                    h.dd([], [row.route]),
                                    h.dt([], ['Release / browser']),
                                    h.dd([], [`${row.release} / ${row.browser}`]),
                                    h.dt([], ['Samples']),
                                    h.dd([], [row.samples.toLocaleString('en-US')]),
                                    h.dt([], ['p75']),
                                    h.dd([], [telemetryP75(key, row.name, row.p75)]),
                                  ],
                                ),
                              ),
                            ),
                    ],
                  ),
                ),
              ),
            ],
          ),
    ],
  )
