/* oxlint-disable anti-slop/no-unsafe-dictionary-type, anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- Unknown API data is refined at this boundary. */
import { Option, Schema } from 'effect'

export type PublicRecord = Readonly<Record<string, unknown>>

export type PublicField = Schema.Json

const isRecord = (value: unknown): value is PublicRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const record = (value: unknown): PublicRecord | null => (isRecord(value) ? value : null)

export const records = (value: unknown): ReadonlyArray<PublicRecord> => {
  const source = isRecord(value) && Array.isArray(value.data) ? value.data : value

  return Array.isArray(source) ? source.filter(isRecord) : []
}

export const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value : fallback

export const strings = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

export const field = (
  item: PublicRecord,
  ...names: ReadonlyArray<string>
): PublicField | undefined => {
  for (const name of names) {
    const value = Option.getOrUndefined(Schema.decodeUnknownOption(Schema.Json)(item[name]))

    if (value !== undefined && value !== null) return value
  }

  return undefined
}

export const nestedRecords = (item: PublicRecord, name: string): ReadonlyArray<PublicRecord> =>
  records(item[name])
