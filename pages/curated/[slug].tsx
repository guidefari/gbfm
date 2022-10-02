import { BackIcon } from '@/components/common/icons'
import { PageSEO } from '@/components/SEO'
import fs from 'fs'
import matter from 'gray-matter'
import { MDXRemote } from 'next-mdx-remote'
import { serialize } from 'next-mdx-remote/serialize'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import Link from 'next/link'
import path from 'path'
import CustomLink from '../../components/CustomLink'
import Layout from '../../components/Layout'
import { postFilePaths, POSTS_PATH } from '../../utils/mdxUtils'

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
  Head,
}

export default function PostPage({ source, frontMatter }) {
  return (
    <>
      <Layout>
        <PageSEO
          title={frontMatter.title}
          description={frontMatter.description || 'Goosebumps.fm curated sounds'}
          ogImageUrl={frontMatter.thumbnailUrl || null}
          canonicalUrl={frontMatter.canonicalUrl || null}
        />

        <header>
          <nav className="w-8 h-8 m-3">
            <Link href="/">
              <a className="hover:text-gb-tomato">
                <BackIcon />
              </a>
            </Link>
          </nav>
        </header>
        <div className="mt-10 mb-12 text-center md:mb-16 lg:mb-24">
          <h1 className="title">{frontMatter.title}</h1>
          {frontMatter.description && (
            <p className="font-bold text-gb-highlight">{frontMatter.description}</p>
          )}
        </div>
        <article className="prose">
          <MDXRemote {...source} components={components} />
        </article>
      </Layout>
    </>
  )
}

export const getStaticPaths = async () => {
  const paths = postFilePaths
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
  const postFilePath = path.join(POSTS_PATH, `${params.slug}.mdx`)
  const source = fs.readFileSync(postFilePath)

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
