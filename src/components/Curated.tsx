import { PostCard } from 'src/components/PostCard'
import { PageSEO } from 'src/components/SEO'
import { compareDesc } from 'date-fns'
import Image from 'next/image'
import CustomLink from 'src/components/CustomLink'
import { allPosts, type Post, allMixes, type Mix } from '@/contentlayer/generated'
import { DEFAULT_IMAGE_URL } from '../constants'

export default function Curated() {
  const posts: Post[] = allPosts
    .sort((a, b) => compareDesc(new Date(a.lastmod || a.date), new Date(b.lastmod || b.date)))
    .filter((post) => post.title !== 'Template post')
  const draftsFilteredOut = posts.filter((post) => post?.draft !== true)

  const mixes: Mix[] = allMixes.sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)))

  return (
    <>
      <PageSEO title="Curated music - Posts" description="Curated Music & the occasional prose" />
      {/* Add Link to a page with Spotify now playing. move the now playing app here? */}
      <section>
        <h3 className="title">Mixes</h3>
        <div className="curated-posts">
          {mixes.map((mix: Mix) => (
            <PostCard
              slug={mix.url}
              title={mix.title}
              description={mix.description}
              date={mix.date}
              key={mix._id}
              thumbnailUrl={mix.thumbnailUrl ?? DEFAULT_IMAGE_URL}
            />
          ))}
        </div>
      </section>
      <section className="mt-28">
        <h3 className="title">Playlists & words</h3>
        <div className="curated-posts">
          {draftsFilteredOut.map((post: Post) => (
            <PostCard
              slug={post.url}
              title={post.title}
              description={post.description}
              date={post.date}
              key={post._id}
              thumbnailUrl={post.thumbnailUrl ?? DEFAULT_IMAGE_URL}
            />
          ))}
        </div>
      </section>

      <section className="max-w-2xl mx-auto mt-20">
        <h5>If you've made it this far, well done & thank you</h5>
        <Image
          src={
            'https://res.cloudinary.com/hokaspokas/image/upload/v1687381358/goosebumpsfm/oxi-clean-but-wait-theres-more_mocva1.gif'
          }
          height={400}
          width={400}
          alt={`But wait, there's more!`}
          unoptimized={true}
          className="mx-auto my-16"
        />
        <div className="flex flex-col justify-between p-5 border rounded shadow-sm">
          <div>
            <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-indigo-50">
              <svg
                className="w-12 h-12 text-deep-purple-accent-400"
                stroke="currentColor"
                viewBox="0 0 52 52"
              >
                <polygon
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  points="29 13 14 29 25 29 23 39 38 23 27 23"
                />
              </svg>
            </div>
            <h6 className="mb-2 font-semibold leading-5">
              <CustomLink href="micro" as="micro">
                Micro Posts
              </CustomLink>
            </h6>
            <p className="mb-3 text-sm ">
              Capturing byte-sized ephemeral thoughts. These are sometimes the inspiration to full
              length write ups.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
