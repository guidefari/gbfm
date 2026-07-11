import { Effect } from 'effect'

type DatabaseErrorTag = { readonly _tag: 'DatabaseError' }

// Undeclared DatabaseError becomes a logged defect (500), same as the old
// runEffect's fallback for anything that wasn't a mapped HttpError. Shared
// across handler groups instead of copy-pasted per group (each copy was
// identical except the log-tag prefix) -- flagged in review on PR #162.
export const dieOnDatabaseError =
  (logTag: string) =>
  <A, E, R>(effect: Effect.Effect<A, E | DatabaseErrorTag, R>) =>
    effect.pipe(
      Effect.tapErrorTag('DatabaseError', (cause) =>
        Effect.logError(`[${logTag}] database operation failed`, cause)
      ),
      Effect.catchTag('DatabaseError', (cause) => Effect.die(cause))
    )
