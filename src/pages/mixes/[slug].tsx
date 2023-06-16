import { PageSEO } from 'src/components/SEO'
import { allMixes, type Mix } from '@/contentlayer/generated'
import { useMDXComponent } from 'next-contentlayer/hooks' // eslint-disable-line
import { MDXcomponents } from '../../lib/mdx'
import { MinimalCard } from '@/components/common/MinimalCard'

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

  const encoded_title = encodeURIComponent(mix.title)
  const full_default_url = `https://goosebumps.fm/api/og?title=${encoded_title}`
  return (
    <>
      <PageSEO
        title={mix.title}
        description={mix.description || 'Goosebumps.fm curated sounds'}
        ogImageUrl={mix.thumbnailUrl || full_default_url}
        canonicalUrl={mix.url || null}
      />

      <article className="px-3 list-disc">
        <div className="flex flex-col md:space-x-5 md:flex-row">
          <MinimalCard
            title={mix.title}
            blurb={mix.description}
            previewUrl={mix.mp3Url}
            imageUrl={mix.thumbnailUrl}
          ></MinimalCard>
          {/* <p className=" md:my-8">
            Let's take this offline.{' '}
            <a href={mix.mp3Url} download={mix.title} rel="noreferrer">
              Download mix
            </a>
          </p> */}
        </div>
        <MDXContent components={MDXcomponents} />
      </article>
    </>
  )
}
