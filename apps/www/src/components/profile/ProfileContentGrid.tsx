import { Link } from '@tanstack/react-router'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import type { PublicProfile } from '@/lib/http'

interface ProfileContentGridProps {
  content: PublicProfile['content']
}

function ContentCard({
  item,
  href
}: {
  item: { title: string; slug: string; thumbnailUrl: string | null }
  href: string
}) {
  return (
    <Link
      to={href}
      className='flex flex-col gap-2 transition-transform group hover:scale-105'>
      <div className='w-full overflow-hidden border rounded-sm shadow-sm aspect-square border-border bg-background'>
        <img
          src={item.thumbnailUrl || DEFAULT_IMAGE_URL}
          alt={item.title}
          className='object-cover w-full h-full transition-opacity group-hover:opacity-80'
        />
      </div>
      <h3 className='text-sm font-semibold leading-tight transition-colors text-foreground group-hover:text-highlight line-clamp-2'>
        {item.title}
      </h3>
    </Link>
  )
}

export function ProfileContentGrid({ content }: ProfileContentGridProps) {
  const mixes = content?.mixes ?? []
  const shows = content?.shows ?? []
  const hasMixes = mixes.length > 0
  const hasShows = shows.length > 0
  const hasContent = hasMixes || hasShows

  if (!hasContent) {
    return (
      <div className='py-8 text-center text-muted-foreground'>
        No public content yet
      </div>
    )
  }

  return (
    <div className='space-y-8'>
      {hasMixes && (
        <section>
          <h2 className='mb-4 text-xl font-semibold text-foreground'>Mixes</h2>
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
            {mixes.map((mix) => (
              <ContentCard
                key={mix.id}
                item={mix}
                href={`/mixes/${mix.slug}`}
              />
            ))}
          </div>
        </section>
      )}

      {hasShows && (
        <section>
          <h2 className='mb-4 text-xl font-semibold text-foreground'>Shows</h2>
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'>
            {shows.map((show) => (
              <ContentCard
                key={show.id}
                item={show}
                href={`/shows/${show.slug}`}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
