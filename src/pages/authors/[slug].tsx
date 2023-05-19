import Layout from 'src/components/Layout'
import CustomLink from 'src/components/CustomLink'
import { PageSEO } from 'src/components/SEO'
import Image from 'next/image'
import { allAuthors, type Author } from 'contentlayer/generated'
import { useMDXComponent } from 'next-contentlayer/hooks' // eslint-disable-line
import { MDXcomponents } from 'src/lib/mdx'

export const getStaticPaths = () => {
  const paths: string[] = allAuthors.map((author) => author.url)
  return {
    paths,
    fallback: false,
  }
}

export const getStaticProps = ({ params }) => {
  const author: Author = allAuthors.find(
    (singleAuthor) => singleAuthor._raw.flattenedPath === `authors/${params.slug}` // eslint-disable-line
  )

  return {
    props: {
      author,
    },
  }
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
              <MDXContent components={MDXcomponents} />
            </article>
          </div>
        </div>
      </Layout>
    </>
  )
}
