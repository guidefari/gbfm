import type { AdminTelemetryResponse } from '@gbfm/api/admin'

export type TelemetryDashboardState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'empty'; readonly data: AdminTelemetryResponse }
  | { readonly status: 'partial'; readonly data: AdminTelemetryResponse }
  | { readonly status: 'populated'; readonly data: AdminTelemetryResponse }

export const telemetryDashboardState = (
  data?: AdminTelemetryResponse,
  failed: boolean = false,
): TelemetryDashboardState => {
  if (failed) return { status: 'error', message: 'Telemetry could not be loaded.' }

  if (data === undefined) return { status: 'loading' }

  if (data.state === 'partial') return { status: 'partial', data }

  if (data.state === 'empty') return { status: 'empty', data }

  return { status: 'populated', data }
}

export const telemetryP75 = (section: string, name: string, value: number | null): string => {
  if (value === null) return '—'

  if (section === 'webVitals' && name.toLowerCase() === 'cls')
    return value.toLocaleString(undefined, { maximumFractionDigits: 3 })

  return `${Math.round(value).toLocaleString()} ms`
}
