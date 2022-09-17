import { authorFilePaths, AUTHORS_PATH } from '@/utils/mdxUtils'
import path from 'path'
import fs from 'fs'
import matter from 'gray-matter'
import { serialize } from 'next-mdx-remote/serialize'
import Layout from '@/components/Layout'
import { BackIcon } from '@/components/common/icons'
import { MDXRemote } from 'next-mdx-remote'
import dynamic from 'next/dynamic'
import CustomLink from '@/components/CustomLink'
import { useRouter } from 'next/router'

import { PageSEO } from '@/components/SEO'
import Image from 'next/future/image'

// Custom components/renderers to pass to MDX.
// Since the MDX files aren't loaded by webpack, they have no knowledge of how
// to handle import statements. Instead, you must include components in scope
// here.
const components = {
  a: CustomLink,
  // It also works with dynamically-imported components, which is especially
  // useful for conditionally loading components for certain routes.
  // See the notes in README.md for more details.
  Album: dynamic(() => import('../../components/Album')),
  Track: dynamic(() => import('../../components/Track')),
}

export default function AuthorPage({ source, frontMatter }) {
  const router = useRouter()

  return (
    <>
      <PageSEO
        title={`About - ${frontMatter.name}`}
        description={`About me - ${frontMatter.name}`}
      />

      <Layout>
        <header>
          <nav className="w-8 h-8 m-3">
            <a onClick={() => router.back()} className="hover:text-highlight hover:cursor-pointer">
              <BackIcon />
            </a>
          </nav>
        </header>
        <div className="flex flex-col justify-between mx-5 mt-10 mb-12 lg:flex-row md:mb-16 lg:mb-24">
          <Image
            src={frontMatter.avatar}
            alt="avatar"
            width="500"
            height="500"
            className="object-cover w-48 h-48 rounded-full aspect-square"
            priority
            quality={100}
          />
          <div>
            <h1 className="title">{frontMatter.name}</h1>
            {frontMatter.title && <p>What I do: {frontMatter.title}</p>}
            {frontMatter.website && (
              <>
                Here's where you can find me on the{' '}
                <CustomLink href={frontMatter.website} as={frontMatter.website}>
                  web
                </CustomLink>
              </>
            )}
            {frontMatter.title && (
              <p>
                I also have{' '}
                <CustomLink href={`mailto:${frontMatter.email}`} as={`mailto:${frontMatter.email}`}>
                  email
                </CustomLink>{' '}
              </p>
            )}
            <article className="my-10 ">
              <MDXRemote {...source} components={components} />
            </article>
          </div>
        </div>
      </Layout>
    </>
  )
}

export const getStaticPaths = async () => {
  const paths = authorFilePaths
    // Remove file extensions for page paths
    .map((path) => path.replace(/\.mdx?$/, ''))
    // Map the path into the static paths object required by Next.js
    .map((slug) => ({ params: { slug } }))

  return {
    paths,
    fallback: false,
  }
}

export const getStaticProps = async ({ params }) => {
  const authorFilePath = path.join(AUTHORS_PATH, `${params.slug}.mdx`)
  const source = fs.readFileSync(authorFilePath)

  const { content, data } = matter(source)

  const mdxSource = await serialize(content, {
    // Optionally pass remark/rehype plugins
    mdxOptions: {
      remarkPlugins: [],
      rehypePlugins: [],
    },
    scope: data,
  })

  return {
    props: {
      source: mdxSource,
      frontMatter: data,
    },
  }
}
