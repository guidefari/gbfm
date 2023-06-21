import { PageSEO } from 'src/components/SEO'
import { allPosts, type Post } from '@/contentlayer/generated'
import { useMDXComponent } from 'next-contentlayer/hooks' // eslint-disable-line
import Image from 'next/image'
import { MDXcomponents } from '../../lib/mdx'
import { LilDate } from '@/components/common/LilDate'

export const getStaticPaths = () => {
  const paths: string[] = allPosts.map((post) => post.url)
  return {
    paths,
    fallback: false,
  }
}

export const getStaticProps = ({ params }) => {
  const post: Post = allPosts.find(
    (singlePost) => singlePost._raw.flattenedPath === `curated/${params.slug}` // eslint-disable-line
  )

  return {
    props: {
      post,
    },
  }
}

export default function PostPage({ post }: { post: Post }) {
  const MDXContent = useMDXComponent(post.body.code)

  const encoded_title = encodeURIComponent(post.title)
  const full_default_url = `https://goosebumps.fm/api/og?title=${encoded_title}`
  return (
    <>
      <PageSEO
        title={post.title}
        description={post.description || 'Goosebumps.fm curated sounds'}
        ogImageUrl={post.thumbnailUrl || full_default_url}
        canonicalUrl={post.canonicalUrl || null}
      />

      <div className="relative grid w-screen grid-flow-row mx-auto max-w-7xl md:grid-flow-col md:grid-cols-3 md:space-x-5">
        <div className="md:ml-2 mt-6 break-words rounded-md w-fit mx-auto md:max-w-[30%] md:fixed md:top-0  self-start md:col-span-1">
          <Image
            className="mx-auto rounded-md"
            src={
              post.thumbnailUrl ||
              'https://res.cloudinary.com/hokaspokas/image/upload/v1663215741/goosebumpsfm/generic_Thumb.svg'
            }
            alt={`Thumbnail image for post titled - ${post.title}`}
            width={320}
            height={320}
            loading="lazy"
            quality={100}
          />
          <h4 className="mx-2 text-left md:mx-0 ">{post.title}</h4>
          <LilDate date={post.date} />
        </div>
        <article className="w-screen min-h-screen px-2 mt-6 prose break-words md:w-auto md:px-0 md:col-start-2 md:col-span-2 text-inherit prose-a:text-inherit hover:prose-a:text-gb-tomato lg:prose-xl">
          {post.description && <p className="text-left ">{post.description}</p>}
          <MDXContent components={MDXcomponents} />
        </article>
      </div>
    </>
  )
}
