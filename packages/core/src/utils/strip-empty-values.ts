import { Effect } from 'effect'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function isEmptyValue(value: JsonValue): boolean {
  if (value === null) return true
  if (Array.isArray(value) && value.length === 0) return true
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- SAFETY: JsonValue's string member has no parser; this discriminant preserves whitespace handling without stringifying object values.
  return typeof value === 'string' && value.trim() === ''
}

function stripEmptyValuesSync<T extends Record<string, JsonValue>>(obj: T): Partial<T> {
  const result: Partial<T> = {}

  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      const value = obj[key]
      if (value === undefined) continue

      if (!isEmptyValue(value)) {
        if (Array.isArray(value)) {
          const filtered = value.filter((item) => !isEmptyValue(item))
          if (filtered.length > 0) {
            Object.assign(result, { [key]: filtered })
          }
        } else {
          Object.assign(result, { [key]: value })
        }
      }
    }
  }

  return result
}

export function stripEmptyValues<T extends Record<string, JsonValue>>(obj: T): Promise<Partial<T>> {
  return Effect.gen(function* () {
    yield* Effect.logDebug('Stripping empty values from object', {
      originalKeys: Object.keys(obj),
      originalSize: Object.keys(obj).length
    })

    const result = stripEmptyValuesSync(obj)

    yield* Effect.logDebug('Empty values stripped', {
      resultKeys: Object.keys(result),
      resultSize: Object.keys(result).length,
      removedKeys: Object.keys(obj).filter((key) => !(key in result))
    })

    return result
  }).pipe(Effect.runPromise)
}
