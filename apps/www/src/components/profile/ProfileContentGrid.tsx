import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import type { PublicProfile } from '@/lib/http'

interface ProfileContentGridProps {
  content: PublicProfile['content']
}

type Mix = PublicProfile['content']['mixes'][number]
type Show = PublicProfile['content']['shows'][number]

function MixCard({ mix }: { mix: Mix }) {
  return (
    <Link
      to='/mixes/$mixId'
      params={{ mixId: mix.slug }}
      className='flex items-center gap-3 p-2 -mx-2 transition-colors rounded-md cursor-pointer group hover:bg-muted/50'>
      <div className='flex-shrink-0 w-12 h-12 overflow-hidden border rounded-sm border-border bg-background'>
        <img
          src={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
          alt={mix.title}
          className='object-cover w-full h-full'
        />
      </div>
      <span className='text-sm font-medium transition-colors text-foreground group-hover:text-highlight line-clamp-2'>
        {mix.title}
      </span>
    </Link>
  )
}

function ShowCard({
  show,
  mixes,
  defaultExpanded
}: {
  show: Show
  mixes: Mix[]
  defaultExpanded: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const hasMixes = mixes.length > 0

  return (
    <div className='overflow-hidden border rounded-lg border-border bg-card'>
      <button
        type='button'
        className={`flex items-center gap-4 p-4 w-full text-left ${hasMixes ? 'cursor-pointer hover:bg-muted/30' : ''} transition-colors`}
        onClick={() => hasMixes && setIsExpanded(!isExpanded)}>
        <Link
          to='/shows/$showSlug'
          params={{ showSlug: show.slug }}
          onClick={(e) => e.stopPropagation()}
          className='flex-shrink-0 w-16 h-16 overflow-hidden border rounded-sm border-border bg-background hover:opacity-80 transition-opacity'>
          <img
            src={show.thumbnailUrl || DEFAULT_IMAGE_URL}
            alt={show.title}
            className='object-cover w-full h-full'
          />
        </Link>
        <div className='flex-1 min-w-0'>
          <Link
            to='/shows/$showSlug'
            params={{ showSlug: show.slug }}
            onClick={(e) => e.stopPropagation()}
            className='text-base font-semibold transition-colors text-foreground hover:text-highlight line-clamp-1'>
            {show.title}
          </Link>
          {hasMixes && (
            <p className='text-sm text-muted-foreground'>
              {mixes.length} {mixes.length === 1 ? 'episode' : 'episodes'}
            </p>
          )}
        </div>
        {hasMixes && (
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {hasMixes && isExpanded && (
        <div className='px-4 pb-4 space-y-1 border-t border-border'>
          <div className='pt-3'>
            {mixes.map((mix) => (
              <MixCard key={mix.id} mix={mix} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StandaloneMixCard({ mix }: { mix: Mix }) {
  return (
    <Link
      to='/mixes/$mixId'
      params={{ mixId: mix.slug }}
      className='flex flex-col gap-2 transition-transform cursor-pointer group hover:scale-105'>
      <div className='w-full overflow-hidden border rounded-sm shadow-sm aspect-square border-border bg-background'>
        <img
          src={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
          alt={mix.title}
          className='object-cover w-full h-full transition-opacity group-hover:opacity-80'
        />
      </div>
      <h3 className='text-sm font-semibold leading-tight transition-colors text-foreground group-hover:text-highlight line-clamp-2'>
        {mix.title}
      </h3>
    </Link>
  )
}

export function ProfileContentGrid({ content }: ProfileContentGridProps) {
  const mixes = content?.mixes ?? []
  const shows = content?.shows ?? []

  const showsById = new Map(shows.map((show) => [show.id, show]))
  const mixesByShowId = new Map<string, Mix[]>()
  const standaloneMixes: Mix[] = []

  for (const mix of mixes) {
    if (mix.showId && showsById.has(mix.showId)) {
      const existing = mixesByShowId.get(mix.showId) || []
      existing.push(mix)
      mixesByShowId.set(mix.showId, existing)
    } else {
      standaloneMixes.push(mix)
    }
  }

  const showsWithMixes = shows.filter((show) => mixesByShowId.has(show.id))
  const showsWithoutMixes = shows.filter((show) => !mixesByShowId.has(show.id))

  const hasContent =
    showsWithMixes.length > 0 ||
    showsWithoutMixes.length > 0 ||
    standaloneMixes.length > 0

  if (!hasContent) {
    return (
      <div className='py-8 text-center text-muted-foreground'>
        No public content yet
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {showsWithMixes.length > 0 && (
        <section className='space-y-3'>
          {showsWithMixes.map((show) => (
            <ShowCard
              key={show.id}
              show={show}
              mixes={mixesByShowId.get(show.id) || []}
              defaultExpanded={showsWithMixes.length === 1}
            />
          ))}
        </section>
      )}

      {showsWithoutMixes.length > 0 && (
        <section className='space-y-3'>
          <h2 className='text-lg font-semibold text-foreground'>Shows</h2>
          {showsWithoutMixes.map((show) => (
            <ShowCard
              key={show.id}
              show={show}
              mixes={[]}
              defaultExpanded={false}
            />
          ))}
        </section>
      )}

      {standaloneMixes.length > 0 && (
        <section>
          <h2 className='mb-4 text-lg font-semibold text-foreground'>Mixes</h2>
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
            {standaloneMixes.map((mix) => (
              <StandaloneMixCard key={mix.id} mix={mix} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
