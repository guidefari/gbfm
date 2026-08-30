import { useAtomSet, useAtomValue } from '@effect/atom-react'
import type { NavigationResultResponse } from '@gbfm/api/navigation'
import { useRouter } from '@tanstack/react-router'
import { Data, Effect, Fiber } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigateMicroPosts } from '@/lib/http'
import {
  peekJump,
  peekOpen,
  peekStepBack,
  peekStepForward,
  visitJump,
  visitOpen,
  visitStepBack,
  visitStepForward,
  type PeekMicroPostNavigation,
  type RecordMicroPostVisit
} from '@/lib/navigation-commands'
import { runNavigationIntent } from '@/lib/navigation-intent'
import {
  confirmHead,
  emptyNeighbourhood,
  expectedSlugFor,
  localDestinationFor,
  makeHead,
  mergeNeighbourhoodIntoTrail,
  neighbourhoodOf,
  optimisticCapabilities,
  preloadTargets,
  projectHead,
  shouldReconcileRoute,
  visitSlug,
  type Capabilities,
  type NavigationHead,
  type Step
} from '@/lib/tweet-nav-state'
import { useTweetTrail, useUpdateTweetTrail } from '@/store/tweetTrail'

const PRELOAD_DEPTH = 3

class NavigationRouteFailure extends Data.TaggedError('NavigationRouteFailure')<{
  readonly cause: unknown
}> {}

type Peek = (
  peek: PeekMicroPostNavigation,
  input: { readonly from: string }
) => ReturnType<PeekMicroPostNavigation>

type Visit = (
  visit: RecordMicroPostVisit,
  input: { readonly from: string; readonly intentToken: string }
) => ReturnType<RecordMicroPostVisit>

export function useTweetNavigation(slug: string) {
  const router = useRouter()
  const { peekMicroPostNavigationEffect, recordMicroPostVisitEffect } = useNavigateMicroPosts()
  const capabilitiesAtom = useMemo(() => Atom.make<Capabilities>(optimisticCapabilities), [])
  const capabilities = useAtomValue(capabilitiesAtom)
  const setCapabilities = useAtomSet(capabilitiesAtom)
  const trail = useTweetTrail()
  const updateTrail = useUpdateTweetTrail()
  const trailRef = useRef(trail)
  trailRef.current = trail
  const headRef = useRef<NavigationHead>(makeHead(slug))
  const intentRef = useRef(0)
  const settledIntentRef = useRef(0)
  const [neighbourhood, setNeighbourhood] = useState(emptyNeighbourhood)
  const [isNavigating, setIsNavigating] = useState(false)

  if (headRef.current.slug !== slug && settledIntentRef.current === intentRef.current) {
    headRef.current = makeHead(slug)
  }

  const acceptResult = useCallback(
    (result: NavigationResultResponse) => {
      const destination = result.destination.slug
      const nextNeighbourhood = neighbourhoodOf(result)
      headRef.current = confirmHead(destination, result.neighbours)
      setCapabilities(result.capabilities)
      setNeighbourhood(nextNeighbourhood)
      updateTrail((current) => mergeNeighbourhoodIntoTrail(current, destination, nextNeighbourhood))
    },
    [setCapabilities, updateTrail]
  )

  const navigateTo = useCallback(
    (destinationSlug: string) =>
      Effect.tryPromise({
        try: () => router.navigate({ to: '/tweet/$slug', params: { slug: destinationSlug } }),
        catch: (cause) => new NavigationRouteFailure({ cause })
      }),
    [router]
  )

  useEffect(() => {
    if (headRef.current.slug === slug && headRef.current.confirmed) return undefined

    const fiber = Effect.runFork(
      peekOpen(peekMicroPostNavigationEffect, { from: slug, slug }).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            if (settledIntentRef.current === intentRef.current) acceptResult(result)
          })
        ),
        Effect.ignore
      )
    )

    Effect.runFork(
      visitOpen(recordMicroPostVisitEffect, {
        from: slug,
        slug,
        intentToken: crypto.randomUUID()
      }).pipe(Effect.ignore)
    )

    return () => {
      Effect.runFork(Fiber.interrupt(fiber))
    }
  }, [acceptResult, peekMicroPostNavigationEffect, recordMicroPostVisitEffect, slug])

  useEffect(() => {
    const targets = preloadTargets(neighbourhood, PRELOAD_DEPTH)
    if (targets.length === 0) return undefined

    const fiber = Effect.runFork(
      Effect.forEach(
        targets,
        (target) =>
          Effect.tryPromise({
            try: () => router.preloadRoute({ to: '/tweet/$slug', params: { slug: target } }),
            catch: (cause) => new NavigationRouteFailure({ cause })
          }),
        { concurrency: 'unbounded' }
      ).pipe(Effect.ignore)
    )

    return () => {
      Effect.runFork(Fiber.interrupt(fiber))
    }
  }, [neighbourhood, router])

  const navigate = useCallback(
    (peek: Peek, visit: Visit, step?: Step) => {
      const head = headRef.current
      const from = head.slug
      const localDestination = step ? localDestinationFor(trailRef.current, from, step) : undefined
      const expectedSlug = localDestination ?? (step ? expectedSlugFor(head, step) : undefined)
      const intentId = intentRef.current + 1
      intentRef.current = intentId
      headRef.current = step ? projectHead(head, step) : { ...head, confirmed: false }
      setIsNavigating(true)

      const isCurrent = () => intentRef.current === intentId

      Effect.runFork(
        visit(recordMicroPostVisitEffect, { from, intentToken: crypto.randomUUID() }).pipe(
          Effect.flatMap((outcome) =>
            outcome.recorded || !isCurrent()
              ? Effect.void
              : peekOpen(peekMicroPostNavigationEffect, {
                  from: headRef.current.slug,
                  slug: headRef.current.slug
                }).pipe(
                  Effect.flatMap((result) =>
                    Effect.sync(() => {
                      if (isCurrent()) acceptResult(result)
                    })
                  )
                )
          ),
          Effect.ignore
        )
      )

      if (expectedSlug) {
        updateTrail((current) => visitSlug(current, expectedSlug))
      }

      const peekEffect = peek(peekMicroPostNavigationEffect, { from }).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            if (isCurrent()) acceptResult(result)
          })
        ),
        Effect.tapError(() => (isCurrent() ? navigateTo(from).pipe(Effect.ignore) : Effect.void))
      )

      const navigationEffect = expectedSlug
        ? Effect.all(
            { result: peekEffect, route: navigateTo(expectedSlug) },
            { concurrency: 'unbounded' }
          ).pipe(Effect.map(({ result }) => result))
        : peekEffect

      runNavigationIntent(
        navigationEffect.pipe(
          Effect.flatMap((result) =>
            shouldReconcileRoute(expectedSlug, result.destination.slug)
              ? navigateTo(result.destination.slug).pipe(Effect.as(result))
              : Effect.succeed(result)
          ),
          Effect.asVoid,
          Effect.ensuring(
            Effect.sync(() => {
              if (!isCurrent()) return
              settledIntentRef.current = intentId
              setIsNavigating(false)
            })
          )
        )
      )
    },
    [
      acceptResult,
      navigateTo,
      peekMicroPostNavigationEffect,
      recordMicroPostVisitEffect,
      updateTrail
    ]
  )

  const goToPrev = useCallback(() => navigate(peekStepBack, visitStepBack, 'back'), [navigate])
  const goToNext = useCallback(
    () => navigate(peekStepForward, visitStepForward, 'forward'),
    [navigate]
  )
  const goToRandom = useCallback(() => navigate(peekJump, visitJump), [navigate])

  return { capabilities, isNavigating, goToPrev, goToNext, goToRandom }
}
