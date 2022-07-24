import Link from 'next/link'
import { MinimalCard } from '../common/MinimalCard'

export const FeaturedArtists = ({ artists }) => {
  return (
    <div className="w-fit pb-10 lg:pb-20">
      <h1 className="mb-10 text-left text-3xl font-bold leading-none md:text-5xl lg:mb-20 lg:text-7xl">
        Featured{' '}
        <Link passHref href="/artist">
          <span className="text-blue-200 underline hover:text-blue-300">Artists</span>
        </Link>
      </h1>
      <section className="flex w-full touch-pan-x flex-nowrap space-x-6 overflow-x-scroll pb-6 pl-6 lg:pb-10">
        {artists.map((artist) => (
          <MinimalCard
            blurb={artist.meta.description}
            title={artist.meta.title}
            key={artist.slug}
            slug={`/artist/${artist.slug}`}
            imageUrl={
              artist.imageUrl ||
              'https://res.cloudinary.com/hokaspokas/image/upload/v1658044917/goosebumpsfm/generic_xvsrwv.svg'
            }
          />
        ))}
      </section>
    </div>
  )
}
