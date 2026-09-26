import type { AdminTelemetryResponse } from '@gbfm/api/admin'
import { describe, expect, test } from 'vitest'

import { telemetryDashboardState, telemetryP75 } from './telemetry-dashboard'

const fixture = (state: AdminTelemetryResponse['state']): AdminTelemetryResponse => ({
  generatedAt: '2026-09-25T12:00:00.000Z',
  windowHours: 24,
  state,
  retentionNotice: '24 hour retention',
  sections: {
    webVitals: { available: true, rows: [] },
    navigation: { available: true, rows: [] },
    errors: { available: true, rows: [] },
    player: { available: true, rows: [] },
  },
})

describe('telemetry dashboard states', () => {
  test('distinguishes loading, request error, empty, partial, and populated data', () => {
    expect(telemetryDashboardState().status).toBe('loading')
    expect(telemetryDashboardState(undefined, true).status).toBe('error')
    expect(telemetryDashboardState(fixture('empty')).status).toBe('empty')
    expect(telemetryDashboardState(fixture('partial')).status).toBe('partial')
    expect(telemetryDashboardState(fixture('complete')).status).toBe('populated')
  })

  test('uses the curated server aggregates without recalculating sampled values', () => {
    const base = fixture('complete')

    const data: AdminTelemetryResponse = {
      ...base,
      sections: {
        ...base.sections,
        webVitals: {
          available: true,
          rows: [
            {
              name: 'LCP',
              route: '/mix/[id]',
              release: 'release-42',
              browser: 'chrome',
              // Independently derived from fixture sample intervals 2 + 3.
              samples: 5,
              p75: 400,
            },
          ],
        },
      },
    }

    const state = telemetryDashboardState(data)
    expect(state.status === 'populated' && state.data.sections.webVitals.rows[0]).toMatchObject({
      samples: 5,
      p75: 400,
    })
  })

  test('labels duration percentiles while preserving CLS as a unitless score', () => {
    expect(telemetryP75('webVitals', 'lcp', 2_345.6)).toBe('2,346 ms')
    expect(telemetryP75('webVitals', 'cls', 0.1234)).toBe('0.123')
    expect(telemetryP75('navigation', 'complete', 411.2)).toBe('411 ms')
    expect(telemetryP75('errors', 'ui-error', null)).toBe('—')
  })
})
