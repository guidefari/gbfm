import { Link } from "@remix-run/react"
import { MinimalCard } from "../common/MinimalCard"

export const FeaturedArtists = ({ artists }) => {
  return (
    <div className="pb-10 lg:pb-20 w-fit">
      <h1 className="mb-10 text-3xl font-bold leading-none text-left lg:mb-20 md:text-5xl lg:text-7xl">
        Featured{" "}
        <Link to="/artist">
          <span className="text-blue-200 underline hover:text-blue-300">
            Artists
          </span>
        </Link>
      </h1>
      <section className="flex w-full pb-6 pl-6 space-x-6 overflow-x-scroll touch-pan-x lg:pb-10 flex-nowrap">
        {artists.map(artist => (
          <MinimalCard
            blurb={artist.meta.description}
            title={artist.meta.title}
            key={artist.slug}
            slug={`/artist/${artist.slug}`}
            imageUrl={
              artist.imageUrl ||
              "https://res.cloudinary.com/hokaspokas/image/upload/v1658044917/goosebumpsfm/generic_xvsrwv.svg"
            }
          />
        ))}
      </section>
    </div>
  )
}
