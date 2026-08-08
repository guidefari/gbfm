import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { Effect, Fiber, Queue, Stream } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'

const HOLD_MS = 900
const SETTLE_MS = 150

export type HoldState =
  | { readonly _tag: 'Idle' }
  | { readonly _tag: 'Holding'; readonly startedAt: number; readonly progress: number }
  | { readonly _tag: 'Completing' }
  | { readonly _tag: 'Cancelled' }

export type HoldEvent =
  | { readonly _tag: 'PointerDown'; readonly now: number }
  | { readonly _tag: 'Tick'; readonly now: number }
  | { readonly _tag: 'ThresholdReached' }
  | { readonly _tag: 'Released' }
  | { readonly _tag: 'Aborted' }
  | { readonly _tag: 'SettleComplete' }

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export function nextHoldState(state: HoldState, event: HoldEvent): HoldState {
  if (state._tag === 'Idle') {
    return event._tag === 'PointerDown'
      ? { _tag: 'Holding', startedAt: event.now, progress: 0 }
      : state
  }

  if (state._tag === 'Holding') {
    switch (event._tag) {
      case 'Tick':
        return { ...state, progress: clamp01((event.now - state.startedAt) / HOLD_MS) }
      case 'ThresholdReached':
        return { _tag: 'Completing' }
      case 'Released':
      case 'Aborted':
        return { _tag: 'Cancelled' }
      default:
        return state
    }
  }

  if (state._tag === 'Completing' || state._tag === 'Cancelled') {
    return event._tag === 'SettleComplete' ? { _tag: 'Idle' } : state
  }

  return state
}

const rafTicks = Stream.callback<number>((queue) =>
  Effect.gen(function* () {
    let handle = 0
    const tick = (time: number) => {
      Queue.offerUnsafe(queue, time)
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)

    yield* Effect.addFinalizer(() => Effect.sync(() => cancelAnimationFrame(handle)))
  })
)

type Props = {
  onTap: () => void
  onHoldComplete: () => void
  ariaLabel: string
  className: string
  children: ReactNode
}

export function HoldToRandomButton({
  onTap,
  onHoldComplete,
  ariaLabel,
  className,
  children
}: Props) {
  const holdAtom = useMemo(() => Atom.make<HoldState>({ _tag: 'Idle' }), [])
  const state = useAtomValue(holdAtom)
  const setState = useAtomSet(holdAtom)
  const fiberRef = useRef<Fiber.Fiber<void> | null>(null)
  const stateRef = useRef<HoldState>(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const dispatch = (event: HoldEvent) => {
    stateRef.current = nextHoldState(stateRef.current, event)
    setState(stateRef.current)
  }

  const interruptTickFiber = () => {
    if (fiberRef.current) {
      Effect.runFork(Fiber.interrupt(fiberRef.current))
      fiberRef.current = null
    }
  }

  useEffect(() => interruptTickFiber, [])

  const startHold = () => {
    dispatch({ _tag: 'PointerDown', now: performance.now() })

    fiberRef.current = Effect.runFork(
      rafTicks.pipe(
        Stream.runForEach((time) =>
          Effect.sync(() => {
            if (stateRef.current._tag !== 'Holding') return
            const progress = clamp01((time - stateRef.current.startedAt) / HOLD_MS)
            if (progress >= 1) {
              dispatch({ _tag: 'ThresholdReached' })
              onHoldComplete()
              setTimeout(() => dispatch({ _tag: 'SettleComplete' }), SETTLE_MS)
            } else {
              dispatch({ _tag: 'Tick', now: time })
            }
          })
        ),
        Effect.catchCause(() => Effect.void)
      )
    )
  }

  const endHold = (outcome: 'Released' | 'Aborted') => {
    if (stateRef.current._tag !== 'Holding') return
    interruptTickFiber()
    dispatch({ _tag: outcome })
    if (outcome === 'Released') onTap()
    setTimeout(() => dispatch({ _tag: 'SettleComplete' }), SETTLE_MS)
  }

  const progress = state._tag === 'Holding' ? state.progress : state._tag === 'Completing' ? 1 : 0

  return (
    <button
      type='button'
      aria-label={ariaLabel}
      onPointerDown={startHold}
      onPointerUp={() => endHold('Released')}
      onPointerLeave={() => endHold('Aborted')}
      onPointerCancel={() => endHold('Aborted')}
      className={cn('relative overflow-hidden', className)}>
      {children}
      <span
        aria-hidden
        className='pointer-events-none absolute inset-0 origin-left bg-highlight/20'
        style={{
          transform: `scaleX(${progress})`,
          transitionProperty: state._tag === 'Holding' ? 'none' : 'transform',
          transitionDuration: `${SETTLE_MS}ms`,
          transitionTimingFunction: 'ease-out'
        }}
      />
    </button>
  )
}
