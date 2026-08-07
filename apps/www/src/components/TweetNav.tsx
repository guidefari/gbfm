import { useHotkey } from '@tanstack/react-hotkeys'
import { Link, useRouter } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAdjacentMicroPosts } from '@/lib/http'
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

function PrevLink({ prev }: { prev: AdjacentPost }) {
  if (!prev) {
    return (
      <span aria-hidden className={disabledIconButtonClassName}>
        <ChevronLeft className='h-4 w-4' />
      </span>
    )
  }

  return (
    <Link
      to='/tweet/$slug'
      params={{ slug: prev.slug }}
      aria-label='Previous tweet'
      className={iconButtonClassName}>
      <ChevronLeft className='h-4 w-4' />
    </Link>
  )
}

function NextLink({ next }: { next: AdjacentPost }) {
  if (!next) {
    return (
      <span aria-hidden className={disabledIconButtonClassName}>
        <ChevronRight className='h-4 w-4' />
      </span>
    )
  }

  return (
    <Link
      to='/tweet/$slug'
      params={{ slug: next.slug }}
      aria-label='Next tweet'
      className={iconButtonClassName}>
      <ChevronRight className='h-4 w-4' />
    </Link>
  )
}

function FlankingArrows({ prev, next }: { prev: AdjacentPost; next: AdjacentPost }) {
  const leftPosition = 'left-[max(1rem,calc(50%-30rem))]'
  const rightPosition = 'right-[max(1rem,calc(50%-30rem))]'

  return (
    <>
      {prev ? (
        <Link
          to='/tweet/$slug'
          params={{ slug: prev.slug }}
          aria-label='Previous tweet'
          className={cn(flankClassName, leftPosition)}>
          <ChevronLeft className='h-6 w-6' />
        </Link>
      ) : (
        <span aria-hidden className={cn(flankClassName, leftPosition, 'text-muted-foreground/20')}>
          <ChevronLeft className='h-6 w-6' />
        </span>
      )}

      {next ? (
        <Link
          to='/tweet/$slug'
          params={{ slug: next.slug }}
          aria-label='Next tweet'
          className={cn(flankClassName, rightPosition)}>
          <ChevronRight className='h-6 w-6' />
        </Link>
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

  const prev = data?.prev ?? null
  const next = data?.next ?? null

  useHotkey('ArrowLeft', () => {
    if (prev) router.navigate({ to: '/tweet/$slug', params: { slug: prev.slug } })
  })

  useHotkey('ArrowRight', () => {
    if (next) router.navigate({ to: '/tweet/$slug', params: { slug: next.slug } })
  })

  return (
    <>
      <div className='flex items-center gap-1 lg:hidden'>
        <PrevLink prev={prev} />
        <NextLink next={next} />
      </div>
      <FlankingArrows prev={prev} next={next} />
    </>
  )
}
