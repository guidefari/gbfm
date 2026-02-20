import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import HorizontalScrollCards from '@/components/common/HorizontalScrollCards'
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import type { PublicProfile } from '@/lib/http'

interface ProfileContentGridProps {
  content: PublicProfile['content']
}

type Mix = PublicProfile['content']['mixes'][number]
type Dispatch = PublicProfile['content']['dispatches'][number]
type Ping = PublicProfile['content']['pings'][number]

const CARD_CLASS = 'w-36 flex-shrink-0'

function StandaloneMixCard({ mix }: { mix: Mix }) {
  return (
    <Link
      to='/mixes/$mixId'
      params={{ mixId: mix.slug }}
      className={`${CARD_CLASS} group flex flex-col gap-2`}>
      <div className='aspect-square w-full overflow-hidden rounded-sm border border-border bg-background'>
        <img
          src={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
          alt={mix.title}
          className='h-full w-full object-cover transition-opacity group-hover:opacity-80'
        />
      </div>
      <h3 className='line-clamp-2 font-mono text-sm font-medium leading-tight text-foreground transition-colors group-hover:text-highlight'>
        {mix.title}
      </h3>
    </Link>
  )
}

function ProfileDispatchCard({ dispatch }: { dispatch: Dispatch }) {
  return (
    <Link
      to='/dispatch/$slug'
      params={{ slug: dispatch.slug }}
      className={`${CARD_CLASS} group flex flex-col gap-2`}>
      {dispatch.thumbnailUrl && (
        <div className='aspect-video w-full overflow-hidden rounded-sm border border-border bg-background'>
          <img
            src={dispatch.thumbnailUrl}
            alt={dispatch.title}
            className='h-full w-full object-cover transition-opacity group-hover:opacity-80'
          />
        </div>
      )}
      <h3 className='line-clamp-2 font-mono text-sm font-medium leading-tight text-foreground transition-colors group-hover:text-highlight'>
        {dispatch.title}
      </h3>
    </Link>
  )
}

function ProfilePingCard({ ping }: { ping: Ping }) {
  const date = new Date(ping.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <Link
      to='/pings/$slug'
      params={{ slug: ping.slug }}
      className={`${CARD_CLASS} group flex flex-col gap-1 rounded-sm border border-border bg-card p-3 transition-colors hover:bg-muted/50`}>
      <h3 className='line-clamp-2 font-mono text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-highlight'>
        {ping.title}
      </h3>
      <p className='font-mono text-xs text-muted-foreground'>{date}</p>
    </Link>
  )
}

function SectionHeader({
  title,
  canScrollLeft,
  canScrollRight,
  onPrev,
  onNext
}: {
  title: string
  canScrollLeft: boolean
  canScrollRight: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className='mb-3 flex items-center gap-2'>
      <h2 className='flex-1 font-mono text-lg font-bold text-highlight'>
        {title}
      </h2>
      <button
        type='button'
        onClick={onPrev}
        disabled={!canScrollLeft}
        className='flex h-8 w-8 items-center justify-center rounded bg-card text-foreground transition-colors hover:text-highlight disabled:opacity-0'>
        <ChevronLeft className='h-5 w-5' />
      </button>
      <button
        type='button'
        onClick={onNext}
        disabled={!canScrollRight}
        className='flex h-8 w-8 items-center justify-center rounded bg-card text-foreground transition-colors hover:text-highlight disabled:opacity-0'>
        <ChevronRight className='h-5 w-5' />
      </button>
    </div>
  )
}

function ContentSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  const { containerRef, canScrollLeft, canScrollRight, scroll } =
    useHorizontalScroll()

  return (
    <section className='py-4'>
      <SectionHeader
        title={title}
        canScrollLeft={canScrollLeft}
        canScrollRight={canScrollRight}
        onPrev={() => scroll('left')}
        onNext={() => scroll('right')}
      />
      <div ref={containerRef}>
        <HorizontalScrollCards>{children}</HorizontalScrollCards>
      </div>
    </section>
  )
}

export function ProfileContentGrid({ content }: ProfileContentGridProps) {
  const mixes = content?.mixes ?? []
  const dispatches = content?.dispatches ?? []
  const pings = content?.pings ?? []

  const hasContent =
    mixes.length > 0 || dispatches.length > 0 || pings.length > 0

  if (!hasContent) {
    return (
      <div className='px-4 py-8 font-mono text-sm text-muted-foreground lg:px-0'>
        No public content yet
      </div>
    )
  }

  return (
    <div className='flex flex-col divide-y divide-border/50'>
      {mixes.length > 0 && (
        <ContentSection title='Mixes'>
          {mixes.map((mix) => (
            <StandaloneMixCard key={mix.id} mix={mix} />
          ))}
        </ContentSection>
      )}

      {dispatches.length > 0 && (
        <ContentSection title='Dispatches'>
          {dispatches.map((dispatch) => (
            <ProfileDispatchCard key={dispatch.id} dispatch={dispatch} />
          ))}
        </ContentSection>
      )}

      {pings.length > 0 && (
        <ContentSection title='Pings'>
          {pings.map((ping) => (
            <ProfilePingCard key={ping.id} ping={ping} />
          ))}
        </ContentSection>
      )}
    </div>
  )
}
