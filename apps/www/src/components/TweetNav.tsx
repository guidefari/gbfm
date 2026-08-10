import { useAtomSet, useAtomValue } from '@effect/atom-react'
import type { NavigationResultResponse } from '@gbfm/api/navigation'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useRouter } from '@tanstack/react-router'
import { Effect, Fiber } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { HoldToRandomButton } from '@/components/HoldToRandomButton'
import { jump, open, stepBack, stepForward } from '@/lib/navigation-commands'
import { useNavigateMicroPosts } from '@/lib/http'
import { runNavigationIntent } from '@/lib/navigation-intent'
import { cn } from '@/lib/utils'

type Props = {
  slug: string
}

type Capabilities = NavigationResultResponse['capabilities']

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
  const [isNavigating, setIsNavigating] = useState(false)
  const [isSyncing, setIsSyncing] = useState(true)

  useEffect(() => {
    setIsSyncing(true)
    const fiber = Effect.runFork(
      open(navigateMicroPostsEffect, {
        from: slug,
        slug,
        intentToken: crypto.randomUUID()
      }).pipe(
        Effect.tap((result) => Effect.sync(() => setCapabilities(result.capabilities))),
        Effect.ignore,
        Effect.ensuring(Effect.sync(() => setIsSyncing(false)))
      )
    )

    return () => {
      Effect.runFork(Fiber.interrupt(fiber))
    }
  }, [navigateMicroPostsEffect, setCapabilities, slug])

  const navigate = (
    command: (intentToken: string) => Effect.Effect<NavigationResultResponse, unknown>
  ) => {
    if (pendingRef.current) return

    pendingRef.current = true
    setIsNavigating(true)
    runNavigationIntent(
      command(crypto.randomUUID()).pipe(
        Effect.tap((result) => Effect.sync(() => setCapabilities(result.capabilities))),
        Effect.flatMap((result) =>
          Effect.promise(() =>
            router.navigate({ to: '/tweet/$slug', params: { slug: result.destination.slug } })
          )
        ),
        Effect.asVoid,
        Effect.ensuring(
          Effect.sync(() => {
            pendingRef.current = false
            setIsNavigating(false)
          })
        )
      )
    )
  }

  const goToPrev = () =>
    navigate((intentToken) => stepBack(navigateMicroPostsEffect, { from: slug, intentToken }))
  const goToNext = () =>
    navigate((intentToken) => stepForward(navigateMicroPostsEffect, { from: slug, intentToken }))
  const onHoldComplete = () =>
    navigate((intentToken) => jump(navigateMicroPostsEffect, { from: slug, intentToken }))

  useHotkey('ArrowLeft', goToPrev)
  useHotkey('ArrowRight', goToNext)

  const { canStepBack, canStepForward, hasUnread } = capabilities
  const isPending = isNavigating || isSyncing

  return (
    <div aria-busy={isPending}>
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
          className='mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground'>
          <LoaderCircle aria-hidden className='h-3.5 w-3.5 animate-spin' />
          {isNavigating ? 'Loading tweet…' : 'Preparing navigation…'}
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
