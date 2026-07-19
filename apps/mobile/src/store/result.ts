import { Cause, Effect, Fiber } from 'effect'
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

export type AsyncResult<T> =
  | { readonly _tag: 'pending'; readonly value: null }
  | { readonly _tag: 'success'; readonly value: T }
  | { readonly _tag: 'failure'; readonly value: null; readonly cause: Cause.Cause<unknown> }

export type AsyncAtomHandle<T> =
  | {
      readonly status: 'pending'
      readonly value: null
      readonly cause: null
      readonly refresh: () => void
    }
  | {
      readonly status: 'success'
      readonly value: T
      readonly cause: null
      readonly refresh: () => void
    }
  | {
      readonly status: 'failure'
      readonly value: null
      readonly cause: Cause.Cause<unknown>
      readonly refresh: () => void
    }

type Store<T> = {
  state: AsyncResult<T>
  listeners: Set<() => void>
  fiber: Fiber.Fiber<T, unknown> | null
}

const createStore = <T>(): Store<T> => ({
  state: { _tag: 'pending', value: null },
  listeners: new Set(),
  fiber: null
})

const notify = <T>(store: Store<T>) => {
  for (const listener of store.listeners) listener()
}

const depsKey = (deps: ReadonlyArray<unknown>) => {
  let key = ''
  for (const d of deps) key += `${typeof d}:${String(d)}|`
  return key
}

export function useAsyncAtom<T>(
  thunk: () => Effect.Effect<T, unknown, never>,
  deps: ReadonlyArray<unknown>
): AsyncAtomHandle<T> {
  const storeRef = useRef<Store<T> | null>(null)
  if (!storeRef.current) storeRef.current = createStore<T>()
  const store = storeRef.current

  const thunkRef = useRef(thunk)
  thunkRef.current = thunk

  const unmountedRef = useRef(false)

  const depsKeyValue = depsKey(deps)

  const start = useCallback(() => {
    if (store.fiber) {
      Effect.runFork(Fiber.interrupt(store.fiber))
    }
    store.state = { _tag: 'pending', value: null }
    notify(store)

    const fiber: Fiber.Fiber<T, unknown> = Effect.runFork(
      thunkRef.current().pipe(
        Effect.tap((value: T) =>
          Effect.sync(() => {
            if (unmountedRef.current) return
            store.state = { _tag: 'success', value }
            notify(store)
          })
        ),
        Effect.tapError((error) =>
          Effect.sync(() => {
            if (unmountedRef.current) return
            store.state = {
              _tag: 'failure',
              value: null,
              cause: Cause.fail(error)
            }
            notify(store)
          })
        ),
        Effect.ensuring(
          Effect.sync(() => {
            if (store.fiber === fiber) {
              store.fiber = null
            }
          })
        )
      )
    )
    store.fiber = fiber
  }, [store])

  useEffect(() => {
    if (unmountedRef.current) return
    start()
  }, [start, depsKeyValue])

  useEffect(
    () => () => {
      unmountedRef.current = true
      if (store.fiber) {
        Effect.runFork(Fiber.interrupt(store.fiber))
        store.fiber = null
      }
    },
    [store]
  )

  const refresh = useCallback(() => {
    start()
  }, [start])

  const getSnapshot = useCallback(() => store.state, [store])
  const subscribe = useCallback(
    (listener: () => void) => {
      store.listeners.add(listener)
      return () => {
        store.listeners.delete(listener)
      }
    },
    [store]
  )
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const state = store.state
  if (state._tag === 'pending') {
    return { status: 'pending', value: null, cause: null, refresh }
  }
  if (state._tag === 'success') {
    return { status: 'success' as const, value: state.value, cause: null, refresh }
  }
  return { status: 'failure' as const, value: null, cause: state.cause, refresh }
}

export function useReadyEffect(callback: () => void, condition: boolean): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (condition) {
      callbackRef.current()
    }
  }, [condition])
}
