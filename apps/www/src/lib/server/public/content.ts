import type { RequestEvent } from '@sveltejs/kit'

import { record, records } from '@/lib/public-content'
/* oxlint-disable anti-slop/no-unsafe-dictionary-type, anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- This module is the API response parsing boundary; unknown JSON is refined before being returned. */
import { apiRequest } from '@/lib/server/api/api-gateway'

export { field, nestedRecords, record, records, strings, text } from '@/lib/public-content'

export type { PublicRecord } from '@/lib/public-content'

export type PublicResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly status: number; readonly message: string }

/** Reads public API data without allowing an unvalidated response shape into a page load. */
export async function getPublicJson(
  event: Pick<RequestEvent, 'platform' | 'request' | 'locals'>,
  path: string,
): Promise<PublicResult> {
  try {
    const response = await apiRequest(event, path)

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message:
          response.status === 404
            ? 'This page could not be found.'
            : 'Content is unavailable right now.',
      }
    }

    const value: unknown = await response.json()

    return { ok: true, value }
  } catch {
    return { ok: false, status: 503, message: 'Content is unavailable right now.' }
  }
}

export const publicList = async (
  event: Pick<RequestEvent, 'platform' | 'request' | 'locals'>,
  path: string,
) => {
  const result = await getPublicJson(event, path)

  return result.ok
    ? { items: records(result.value), failure: null }
    : { items: [], failure: result.message }
}

export const publicDetail = async (
  event: Pick<RequestEvent, 'platform' | 'request' | 'locals'>,
  path: string,
) => {
  const result = await getPublicJson(event, path)

  return result.ok
    ? { item: record(result.value), failure: null }
    : { item: null, failure: result.message }
}
