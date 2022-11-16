import Layout from '@/components/Layout'
import dynamic from 'next/dynamic'
import CustomLink from '@/components/CustomLink'
import { PageSEO } from '@/components/SEO'
import Image from 'next/image'
import { allAuthors, type Author } from 'contentlayer/generated'
import { useMDXComponent } from 'next-contentlayer/hooks'

export const getStaticPaths = async () => {
  const paths: string[] = allAuthors.map((author) => author.url)
  return {
    paths,
    fallback: false,
  }
}

export const getStaticProps = async ({ params }) => {
  const author: Author = allAuthors.find(
    (author) => author._raw.flattenedPath === `authors/${params.slug}`
  )

  return {
    props: {
      author,
    },
  }
}

const components = {
  a: CustomLink,
  Album: dynamic(() => import('../../components/Album')),
  Track: dynamic(() => import('../../components/Track')),
}

export default function AuthorPage({ author }: { author: Author }) {
  const MDXContent = useMDXComponent(author.body.code)

  return (
    <>
      <PageSEO title={`About - ${author.name}`} description={`About me - ${author.name}`} />

      <Layout>
        <div className="flex flex-col justify-between mx-5 mt-10 mb-12 lg:flex-row md:mb-16 lg:mb-24">
          <Image
            src={author.avatar}
            alt="avatar"
            width="500"
            height="500"
            className="object-cover w-48 h-48 rounded-full aspect-square"
            priority
            quality={100}
          />
          <div>
            <h1 className="title">{author.name}</h1>
            {author.title && <p>What I do: {author.title}</p>}
            {author.website && (
              <>
                Here's where you can find me on the{' '}
                <CustomLink href={author.website} as={author.website}>
                  web
                </CustomLink>
              </>
            )}
            {author.title && (
              <p>
                I also have{' '}
                <CustomLink href={`mailto:${author.email}`} as={`mailto:${author.email}`}>
                  email
                </CustomLink>{' '}
              </p>
            )}
            <article className="my-10 ">
              <MDXContent components={components} />
            </article>
          </div>
        </div>
      </Layout>
    </>
  )
}
