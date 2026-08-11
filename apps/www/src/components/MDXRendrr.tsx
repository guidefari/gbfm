import { runSync } from '@mdx-js/mdx'
import { useEffect, useMemo } from 'react'
import * as runtime from 'react/jsx-runtime'
import { log } from '@/services/logger'
import { CustomMDXComponents } from './mdx-components'

type LoadedContentType = ReturnType<typeof runSync>['default']

type RenderedContent =
  | { Content: LoadedContentType; error: null }
  | { Content: null; error: Error }
  | { Content: null; error: null }

const renderContent = (mdxString: string): RenderedContent => {
  if (!mdxString.trim()) return { Content: null, error: null }
  try {
    const { default: Content } = runSync(mdxString, {
      ...runtime,
      baseUrl: import.meta.url
    })
    return { Content, error: null }
  } catch (error) {
    return {
      Content: null,
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}

export function MDXRendrr({ mdxString }: { mdxString: string }) {
  const rendered = useMemo(() => renderContent(mdxString), [mdxString])

  useEffect(() => {
    if (rendered.error) log('error', 'MDX compilation error', { error: rendered.error })
  }, [rendered.error])

  if (rendered.error) {
    return (
      <div className='p-4 rounded-md bg-red-900/20 border border-red-500/20'>
        <p className='text-red-400 text-base'>Invalid MDX syntax. Please check your content.</p>
        <details className='mt-2'>
          <summary className='text-red-300 text-xs cursor-pointer'>Show raw content</summary>
          <pre className='mt-2 p-2 bg-red-900/10 rounded text-xs text-red-200 whitespace-pre-wrap wrap-break-word'>
            {mdxString}
          </pre>
        </details>
      </div>
    )
  }

  const Content = rendered.Content
  return <div>{Content ? <Content components={CustomMDXComponents} /> : null}</div>
}
