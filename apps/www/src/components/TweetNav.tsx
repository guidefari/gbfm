import { useAtomSet, useAtomValue } from '@effect/atom-react'
import type { NavigationResultResponse } from '@gbfm/api/navigation'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useRouter } from '@tanstack/react-router'
import { Data, Effect, Fiber } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HoldToRandomButton } from '@/components/HoldToRandomButton'
import {
  jump,
  open,
  stepBack,
  stepForward,
  type NavigateMicroPosts
} from '@/lib/navigation-commands'
import { useNavigateMicroPosts } from '@/lib/http'
import { runNavigationIntent } from '@/lib/navigation-intent'
import { cn } from '@/lib/utils'

type Props = {
  slug: string
}

type Capabilities = NavigationResultResponse['capabilities']
type Neighbours = NavigationResultResponse['neighbours']

class NavigationRouteFailure extends Data.TaggedError('NavigationRouteFailure')<{
  readonly cause: unknown
}> {}

const emptyCapabilities: Capabilities = {
  canStepBack: false,
  canStepForward: false,
  hasUnread: false
}

const iconButtonClassName =
  'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground'
const disabledIconButtonClassName =
  'inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-sm text-muted-foreground/25'

const flankBaseClassName =
  'fixed top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors lg:flex'
const flankClassName = cn(
  flankBaseClassName,
  'cursor-pointer hover:bg-muted/60 hover:text-foreground'
)
const disabledFlankClassName = cn(flankBaseClassName, 'cursor-not-allowed text-muted-foreground/20')

function PrevLink({ enabled, onTap }: { enabled: boolean; onTap: () => void }) {
  if (!enabled) {
    return (
      <span aria-hidden className={disabledIconButtonClassName}>
        <ChevronLeft className='h-4 w-4' />
      </span>
    )
  }

  return (
    <button
      type='button'
      aria-label='Previous tweet'
      onClick={onTap}
      className={iconButtonClassName}>
      <ChevronLeft className='h-4 w-4' />
    </button>
  )
}

function NextLink({
  enabled,
  hasUnread,
  onTap,
  onHoldComplete
}: {
  enabled: boolean
  hasUnread: boolean
  onTap: () => void
  onHoldComplete: () => void
}) {
  if (!enabled) {
    return (
      <span aria-hidden className={disabledIconButtonClassName}>
        <ChevronRight className='h-4 w-4' />
      </span>
    )
  }

  return (
    <HoldToRandomButton
      onTap={onTap}
      onHoldComplete={hasUnread ? onHoldComplete : () => {}}
      ariaLabel='Next tweet (hold for random)'
      className={iconButtonClassName}>
      <ChevronRight className='h-4 w-4' />
    </HoldToRandomButton>
  )
}

function FlankingArrows({
  canStepBack,
  canStepForward,
  hasUnread,
  onTapPrev,
  onTapNext,
  onHoldComplete
}: {
  canStepBack: boolean
  canStepForward: boolean
  hasUnread: boolean
  onTapPrev: () => void
  onTapNext: () => void
  onHoldComplete: () => void
}) {
  const leftPosition = 'left-[max(1rem,calc(50%-30rem))]'
  const rightPosition = 'right-[max(1rem,calc(50%-30rem))]'

  return (
    <>
      {canStepBack ? (
        <button
          type='button'
          aria-label='Previous tweet'
          onClick={onTapPrev}
          className={cn(flankClassName, leftPosition)}>
          <ChevronLeft className='h-6 w-6' />
        </button>
      ) : (
        <span aria-hidden className={cn(disabledFlankClassName, leftPosition)}>
          <ChevronLeft className='h-6 w-6' />
        </span>
      )}

      {canStepForward ? (
        <HoldToRandomButton
          onTap={onTapNext}
          onHoldComplete={hasUnread ? onHoldComplete : () => {}}
          ariaLabel='Next tweet (hold for random)'
          className={cn(flankClassName, rightPosition)}>
          <ChevronRight className='h-6 w-6' />
        </HoldToRandomButton>
      ) : (
        <span aria-hidden className={cn(disabledFlankClassName, rightPosition)}>
          <ChevronRight className='h-6 w-6' />
        </span>
      )}
    </>
  )
}

export function TweetNav({ slug }: Props) {
  const router = useRouter()
  const { navigateMicroPostsEffect } = useNavigateMicroPosts()
  const capabilitiesAtom = useMemo(() => Atom.make<Capabilities>(emptyCapabilities), [])
  const capabilities = useAtomValue(capabilitiesAtom)
  const setCapabilities = useAtomSet(capabilitiesAtom)
  const pendingRef = useRef(false)
  const preloadGenerationRef = useRef(0)
  const [neighbours, setNeighbours] = useState<Neighbours>({})
  const [isNavigating, setIsNavigating] = useState(false)
  const [isPreloadingNeighbours, setIsPreloadingNeighbours] = useState(false)
  const [isRoutePending, setIsRoutePending] = useState(false)
  const [isSyncing, setIsSyncing] = useState(true)

  const acceptNavigation = useCallback(
    (result: NavigationResultResponse) => {
      setCapabilities(result.capabilities)
      setNeighbours(result.neighbours)
    },
    [setCapabilities]
  )
  const preloadNeighbours = useCallback(
    (neighboursToPreload: Neighbours) =>
      Effect.forEach(
        [neighboursToPreload.back, neighboursToPreload.forward].filter(
          (neighbour) => neighbour !== undefined
        ),
        (neighbour) =>
          Effect.tryPromise({
            try: () => router.preloadRoute({ to: '/tweet/$slug', params: { slug: neighbour } }),
            catch: (cause) => new NavigationRouteFailure({ cause })
          }),
        { concurrency: 'unbounded' }
      ).pipe(Effect.ignore),
    [router]
  )

  useEffect(() => {
    if (pendingRef.current) {
      setIsSyncing(false)
      return undefined
    }

    setIsSyncing(true)
    const fiber = Effect.runFork(
      open(navigateMicroPostsEffect, {
        from: slug,
        slug,
        intentToken: crypto.randomUUID()
      }).pipe(
        Effect.tap((result) => Effect.sync(() => acceptNavigation(result))),
        Effect.ignore,
        Effect.ensuring(Effect.sync(() => setIsSyncing(false)))
      )
    )

    return () => {
      Effect.runFork(Fiber.interrupt(fiber))
    }
  }, [acceptNavigation, navigateMicroPostsEffect, slug])

  useEffect(() => {
    const generation = preloadGenerationRef.current + 1
    preloadGenerationRef.current = generation
    if (!neighbours.back && !neighbours.forward) {
      setIsPreloadingNeighbours(false)
      return undefined
    }

    setIsPreloadingNeighbours(true)
    const fiber = Effect.runFork(
      preloadNeighbours(neighbours).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            if (preloadGenerationRef.current === generation) setIsPreloadingNeighbours(false)
          })
        )
      )
    )
    return () => {
      Effect.runFork(Fiber.interrupt(fiber))
    }
  }, [neighbours, preloadNeighbours])

  const navigate = (
    command: (intentToken: string) => ReturnType<NavigateMicroPosts>,
    expectedSlug?: string
  ) => {
    if (pendingRef.current) return

    pendingRef.current = true
    setIsNavigating(true)
    setIsRoutePending(true)
    const navigateTo = (destinationSlug: string) =>
      Effect.sync(() => setIsRoutePending(true)).pipe(
        Effect.andThen(
          Effect.tryPromise({
            try: () => router.navigate({ to: '/tweet/$slug', params: { slug: destinationSlug } }),
            catch: (cause) => new NavigationRouteFailure({ cause })
          })
        ),
        Effect.ensuring(Effect.sync(() => setIsRoutePending(false)))
      )
    const commandEffect = command(crypto.randomUUID()).pipe(
      Effect.tap((result) => Effect.sync(() => acceptNavigation(result))),
      expectedSlug
        ? Effect.tapError(() => navigateTo(slug).pipe(Effect.ignore))
        : (effect) => effect
    )
    const navigationEffect = expectedSlug
      ? Effect.all(
          {
            result: commandEffect,
            route: navigateTo(expectedSlug)
          },
          { concurrency: 'unbounded' }
        ).pipe(Effect.map(({ result }) => result))
      : commandEffect

    runNavigationIntent(
      navigationEffect.pipe(
        Effect.flatMap((result) =>
          expectedSlug === result.destination.slug
            ? Effect.succeed(result)
            : navigateTo(result.destination.slug).pipe(Effect.as(result))
        ),
        Effect.asVoid,
        Effect.ensuring(
          Effect.sync(() => {
            pendingRef.current = false
            setIsNavigating(false)
            setIsRoutePending(false)
          })
        )
      )
    )
  }

  const goToPrev = () =>
    navigate(
      (intentToken) => stepBack(navigateMicroPostsEffect, { from: slug, intentToken }),
      neighbours.back
    )
  const goToNext = () =>
    navigate(
      (intentToken) => stepForward(navigateMicroPostsEffect, { from: slug, intentToken }),
      neighbours.forward
    )
  const onHoldComplete = () =>
    navigate((intentToken) => jump(navigateMicroPostsEffect, { from: slug, intentToken }))

  useHotkey('ArrowLeft', goToPrev)
  useHotkey('ArrowRight', goToNext)

  const { canStepBack, canStepForward, hasUnread } = capabilities
  const isPending = isNavigating || isPreloadingNeighbours || isSyncing

  return (
    <div aria-busy={isPending} className='relative'>
      <div className='flex items-center gap-1 lg:hidden'>
        <PrevLink enabled={canStepBack && !isPending} onTap={goToPrev} />
        <NextLink
          enabled={canStepForward && !isPending}
          hasUnread={hasUnread}
          onTap={goToNext}
          onHoldComplete={onHoldComplete}
        />
      </div>
      {isPending && (
        <div
          role='status'
          aria-live='polite'
          className='pointer-events-none absolute right-0 top-0 z-40 flex min-h-8 items-center gap-2 whitespace-nowrap rounded-md border border-border/60 bg-background/95 px-3 py-1.5 font-mono text-xs text-muted-foreground shadow-lg backdrop-blur-sm lg:fixed lg:bottom-20 lg:left-1/2 lg:right-auto lg:top-auto lg:-translate-x-1/2'>
          <LoaderCircle aria-hidden className='h-3.5 w-3.5 motion-safe:animate-spin' />
          {isRoutePending
            ? 'Loading tweet…'
            : isNavigating
              ? 'Syncing navigation…'
              : 'Preparing navigation…'}
        </div>
      )}
      <FlankingArrows
        canStepBack={canStepBack && !isPending}
        canStepForward={canStepForward && !isPending}
        hasUnread={hasUnread}
        onTapPrev={goToPrev}
        onTapNext={goToNext}
        onHoldComplete={onHoldComplete}
      />
    </div>
  )
}
