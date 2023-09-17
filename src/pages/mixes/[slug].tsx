import { PageSEO } from 'src/components/SEO'
import { allMixes, type Mix } from '@/contentlayer/generated'
import { useMDXComponent } from 'next-contentlayer/hooks' // eslint-disable-line
import { MDXcomponents } from '../../lib/mdx'
import { MinimalCard } from '@/components/common/MinimalCard'
import { DEFAULT_IMAGE_URL } from '@/src/constants'
import { LilDate } from '@/components/common/LilDate'

export const getStaticPaths = () => {
  const paths: string[] = allMixes.map((mix) => mix.url)
  return {
    paths,
    fallback: false,
  }
}

export const getStaticProps = ({ params }) => {
  const mix: Mix = allMixes.find(
    (singlePost) => singlePost._raw.flattenedPath === `mixes/${params.slug}` // eslint-disable-line
  )

  return {
    props: {
      mix,
    },
  }
}

export default function PostPage({ mix }: { mix: Mix }) {
  const MDXContent = useMDXComponent(mix.body.code)

  return (
    <>
      <PageSEO
        title={mix.title}
        description={mix.description || 'Goosebumps.fm curated sounds'}
        ogImageUrl={mix.thumbnailUrl || DEFAULT_IMAGE_URL}
        canonicalUrl={mix.url || null}
      />

      <div className="relative grid grid-flow-row mx-auto max-w-7xl md:grid-flow-col md:grid-cols-3 md:space-x-5">
        <div className="self-start px-2 mx-auto w-fit md:fixed md:max-w-[30%] md:top-0 md:col-span-1">
          <MinimalCard
            title={mix.title}
            previewUrl={mix.mp3Url}
            imageUrl={mix.thumbnailUrl ?? DEFAULT_IMAGE_URL}
            download
          ></MinimalCard>
          <LilDate date={mix.date} />
        </div>
        <article className="min-h-screen px-2 mt-6 prose break-words md:w-auto md:px-0 md:col-start-2 md:col-span-2 text-inherit prose-a:text-inherit hover:prose-a:text-gb-tomato lg:prose-xl">
          {/* <p className=" md:my-8">
            Let's take this offline.{' '}
            <a href={mix.mp3Url} download={mix.title} rel="noreferrer">
              Download mix
            </a>
          </p> */}
          <p>{mix.description}</p>
          <MDXContent components={MDXcomponents} />
        </article>
      </div>
    </>
  )
}
