import Layout from '@/components/Layout'
import { PageSEO } from '@/components/SEO'
import { allPosts, type Post } from 'contentlayer/generated'
import { useMDXComponent } from 'next-contentlayer/hooks' // eslint-disable-line
import Head from 'next/head'
import Image from 'next/image'
import { MDXcomponents } from '../../lib/mdx'

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
    <Layout>
      <PageSEO
        title={post.title}
        description={post.description || 'Goosebumps.fm curated sounds'}
        ogImageUrl={post.thumbnailUrl || full_default_url}
        canonicalUrl={post.canonicalUrl || null}
      />

      <div className="grid grid-cols-4 p-2 mt-10 mb-12 space-x-5 md:px-3 md:mb-16 lg:mb-24">
        <Image
          className="object-cover w-full col-span-4 mx-auto rounded-md md:col-span-1 md:mx-0 aspect-square"
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
        <div className="col-span-4 text-center md:col-span-3">
          <h3 className="my-0 text-left">{post.title}</h3>
          {post.description && <p className="font-bold text-left ">{post.description}</p>}
        </div>
      </div>
      <article className="px-3 list-disc">
        <MDXContent components={MDXcomponents} />
      </article>
    </Layout>
  )
}
