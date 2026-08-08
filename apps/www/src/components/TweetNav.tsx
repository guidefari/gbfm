import { useHotkey } from '@tanstack/react-hotkeys'
import { useRouter } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HoldToRandomButton } from '@/components/HoldToRandomButton'
import { useAdjacentMicroPosts, useRandomMicroPost } from '@/lib/http'
import { cn } from '@/lib/utils'

type Props = {
  slug: string
}

const iconButtonClassName =
  'inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground'
const disabledIconButtonClassName =
  'inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground/25'

type AdjacentPost = { slug: string } | null

const flankClassName =
  'fixed top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground lg:flex'

function PrevLink({
  prev,
  onTap,
  onHoldComplete
}: {
  prev: AdjacentPost
  onTap: () => void
  onHoldComplete: () => void
}) {
  if (!prev) {
    return (
      <span aria-hidden className={disabledIconButtonClassName}>
        <ChevronLeft className='h-4 w-4' />
      </span>
    )
  }

  return (
    <HoldToRandomButton
      onTap={onTap}
      onHoldComplete={onHoldComplete}
      ariaLabel='Previous tweet (hold for random)'
      className={iconButtonClassName}>
      <ChevronLeft className='h-4 w-4' />
    </HoldToRandomButton>
  )
}

function NextLink({
  next,
  onTap,
  onHoldComplete
}: {
  next: AdjacentPost
  onTap: () => void
  onHoldComplete: () => void
}) {
  if (!next) {
    return (
      <span aria-hidden className={disabledIconButtonClassName}>
        <ChevronRight className='h-4 w-4' />
      </span>
    )
  }

  return (
    <HoldToRandomButton
      onTap={onTap}
      onHoldComplete={onHoldComplete}
      ariaLabel='Next tweet (hold for random)'
      className={iconButtonClassName}>
      <ChevronRight className='h-4 w-4' />
    </HoldToRandomButton>
  )
}

function FlankingArrows({
  prev,
  next,
  onTapPrev,
  onTapNext,
  onHoldComplete
}: {
  prev: AdjacentPost
  next: AdjacentPost
  onTapPrev: () => void
  onTapNext: () => void
  onHoldComplete: () => void
}) {
  const leftPosition = 'left-[max(1rem,calc(50%-30rem))]'
  const rightPosition = 'right-[max(1rem,calc(50%-30rem))]'

  return (
    <>
      {prev ? (
        <HoldToRandomButton
          onTap={onTapPrev}
          onHoldComplete={onHoldComplete}
          ariaLabel='Previous tweet (hold for random)'
          className={cn(flankClassName, leftPosition)}>
          <ChevronLeft className='h-6 w-6' />
        </HoldToRandomButton>
      ) : (
        <span aria-hidden className={cn(flankClassName, leftPosition, 'text-muted-foreground/20')}>
          <ChevronLeft className='h-6 w-6' />
        </span>
      )}

      {next ? (
        <HoldToRandomButton
          onTap={onTapNext}
          onHoldComplete={onHoldComplete}
          ariaLabel='Next tweet (hold for random)'
          className={cn(flankClassName, rightPosition)}>
          <ChevronRight className='h-6 w-6' />
        </HoldToRandomButton>
      ) : (
        <span aria-hidden className={cn(flankClassName, rightPosition, 'text-muted-foreground/20')}>
          <ChevronRight className='h-6 w-6' />
        </span>
      )}
    </>
  )
}

export function TweetNav({ slug }: Props) {
  const router = useRouter()
  const { data } = useAdjacentMicroPosts(slug)
  const { goToRandom } = useRandomMicroPost()

  const prev = data?.prev ?? null
  const next = data?.next ?? null

  const goToPrev = () => {
    if (prev) router.navigate({ to: '/tweet/$slug', params: { slug: prev.slug } })
  }

  const goToNext = () => {
    if (next) router.navigate({ to: '/tweet/$slug', params: { slug: next.slug } })
  }

  const onHoldComplete = () => goToRandom(slug)

  useHotkey('ArrowLeft', goToPrev)
  useHotkey('ArrowRight', goToNext)

  return (
    <>
      <div className='flex items-center gap-1 lg:hidden'>
        <PrevLink prev={prev} onTap={goToPrev} onHoldComplete={onHoldComplete} />
        <NextLink next={next} onTap={goToNext} onHoldComplete={onHoldComplete} />
      </div>
      <FlankingArrows
        prev={prev}
        next={next}
        onTapPrev={goToPrev}
        onTapNext={goToNext}
        onHoldComplete={onHoldComplete}
      />
    </>
  )
}
