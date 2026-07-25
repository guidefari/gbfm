import { Effect, Schema } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'

/** Atom whose value is mirrored to localStorage, decoded through a schema so
 *  malformed or outdated stored values fall back to the default. */
export const persistedAtom = <S extends Schema.Top & { readonly DecodingServices: never }>({
  key,
  schema,
  fallback
}: {
  readonly key: string
  readonly schema: S
  readonly fallback: S['Type']
}) => {
  const read = (): S['Type'] => {
    if (typeof window === 'undefined') return fallback
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback

    return Effect.runSync(
      Effect.try({ try: (): unknown => JSON.parse(raw), catch: () => null }).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(schema)),
        Effect.catch(() => Effect.succeed(fallback))
      )
    )
  }

  const write = (value: S['Type']) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  }

  const atom = Atom.make<S['Type']>(read()).pipe(Atom.keepAlive)

  return { atom, write }
}
