const NOISE_PATH_PATTERN = /(?:^|\/)(?:health|robots\.txt|sitemap\.xml)(?:$|[/?#])/i
const MUSIC_RESOLVE_PATH_PATTERN = /\/api\/music\/resolve(?:\/|$|[?#])/i
const BUSINESS_PATH_PATTERN = /\/(?:api\/(?:profile|music|audio|shows?|content)|auth)(?:\/|$|[?#])/i

export type TraceSamplingInput = {
  readonly name: string
  readonly url?: string
}

/**
 * Returns the head-sampling rate for a trace without depending on a telemetry SDK.
 *
 * Errors remain independently captured by Sentry. This policy preserves more business-route
 * traces while sharply reducing synthetic liveness and crawler noise.
 */
export function traceSampleRate({ name, url }: TraceSamplingInput): number {
  const target = url ?? name
  if (NOISE_PATH_PATTERN.test(target)) return 0.01
  if (MUSIC_RESOLVE_PATH_PATTERN.test(target)) return 1
  if (BUSINESS_PATH_PATTERN.test(target)) return 0.5
  return 0.2
}
