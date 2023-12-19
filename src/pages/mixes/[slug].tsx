import { allMixes, type Mix } from '@/contentlayer/generated'
import { LongPost } from '@/components/Layouts/LongPost'

export const getStaticPaths = () => {
  const paths: string[] = allMixes.map((mix) => mix.url)
  return {
    paths,
    fallback: false,
  }
}

export const getStaticProps = ({ params }) => {
  const mix: Mix = allMixes.find(
    (singlePost) => singlePost._raw.flattenedPath === `mixes/${params.slug}`
  )

  return {
    props: {
      mix,
    },
  }
}

export default function PostPage({ mix }: { mix: Mix }) {
  return (
    <LongPost
      content={mix.body.code}
      title={mix.title}
      date={mix.date}
      thumbnailUrl={mix.thumbnailUrl}
      description={mix.description}
      youtubeId={mix.youtubeId}
    />
  )
}
