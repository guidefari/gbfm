import { useHotkey } from '@tanstack/react-hotkeys'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HoldToRandomButton } from '@/components/HoldToRandomButton'
import { NavigationStatus } from '@/components/NavigationStatus'
import { useTweetNavigation } from '@/lib/use-tweet-navigation'
import { cn } from '@/lib/utils'

type Props = {
  slug: string
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
  const { capabilities, isNavigating, goToPrev, goToNext, goToRandom } = useTweetNavigation(slug)

  useHotkey('ArrowLeft', goToPrev)
  useHotkey('ArrowRight', goToNext)

  const { canStepBack, canStepForward, hasUnread } = capabilities

  return (
    <div aria-busy={isNavigating} className='relative'>
      <div className='flex items-center gap-1 lg:hidden'>
        <PrevLink enabled={canStepBack} onTap={goToPrev} />
        <NextLink
          enabled={canStepForward}
          hasUnread={hasUnread}
          onTap={goToNext}
          onHoldComplete={goToRandom}
        />
      </div>
      <NavigationStatus active={isNavigating} label='Loading tweet…' />
      <FlankingArrows
        canStepBack={canStepBack}
        canStepForward={canStepForward}
        hasUnread={hasUnread}
        onTapPrev={goToPrev}
        onTapNext={goToNext}
        onHoldComplete={goToRandom}
      />
    </div>
  )
}
