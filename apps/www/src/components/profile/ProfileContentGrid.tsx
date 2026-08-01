import { HorizontalScrollCards } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Artwork } from '@/components/common/Artwork'
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll'
import type { PublicProfile } from '@/lib/http'

interface ProfileContentGridProps {
  content: PublicProfile['content']
}

type Mix = PublicProfile['content']['mixes'][number]
type Editorial = PublicProfile['content']['editorials'][number]
type Tweet = PublicProfile['content']['tweets'][number]

const CARD_CLASS = 'w-36 shrink-0'

function StandaloneMixCard({ mix }: { mix: Mix }) {
  return (
    <Link
      to='/mixes/$mixId'
      params={{ mixId: mix.slug }}
      className={`${CARD_CLASS} group flex flex-col gap-2`}>
      <Artwork src={mix.thumbnailUrl} alt={mix.title} hover='fade' className='w-full' />
      <h3 className='line-clamp-2 font-mono text-base font-medium leading-tight text-foreground transition-colors group-hover:text-highlight'>
        {mix.title}
      </h3>
    </Link>
  )
}

function ProfileEditorialCard({ editorial }: { editorial: Editorial }) {
  return (
    <Link
      to='/editorial/$slug'
      params={{ slug: editorial.slug }}
      className={`${CARD_CLASS} group flex flex-col gap-2`}>
      {editorial.thumbnailUrl && (
        <Artwork
          src={editorial.thumbnailUrl}
          alt={editorial.title}
          aspect='auto'
          hover='fade'
          className='aspect-video w-full'
        />
      )}
      <h3 className='line-clamp-2 font-mono text-base font-medium leading-tight text-foreground transition-colors group-hover:text-highlight'>
        {editorial.title}
      </h3>
    </Link>
  )
}

function ProfileTweetCard({ tweet }: { tweet: Tweet }) {
  const date = new Date(tweet.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return (
    <Link
      to='/tweet/$slug'
      params={{ slug: tweet.slug }}
      className={`${CARD_CLASS} group flex flex-col gap-1 rounded-sm border border-border bg-card p-3 transition-colors hover:bg-muted/50`}>
      {tweet.title && (
        <h3 className='line-clamp-2 font-mono text-base font-semibold leading-tight text-foreground transition-colors group-hover:text-highlight'>
          {tweet.title}
        </h3>
      )}
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
      <h2 className='flex-1 font-mono text-lg font-bold text-highlight'>{title}</h2>
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

function ContentSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { containerRef, canScrollLeft, canScrollRight, scroll } = useHorizontalScroll()

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
  const editorials = content?.editorials ?? []
  const tweets = content?.tweets ?? []

  const hasContent = mixes.length > 0 || editorials.length > 0 || tweets.length > 0

  if (!hasContent) {
    return (
      <div className='px-4 py-8 font-mono text-base text-muted-foreground lg:px-0'>
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

      {editorials.length > 0 && (
        <ContentSection title='Editorial'>
          {editorials.map((editorial) => (
            <ProfileEditorialCard key={editorial.id} editorial={editorial} />
          ))}
        </ContentSection>
      )}

      {tweets.length > 0 && (
        <ContentSection title='Tweet'>
          {tweets.map((tweet) => (
            <ProfileTweetCard key={tweet.id} tweet={tweet} />
          ))}
        </ContentSection>
      )}
    </div>
  )
}
