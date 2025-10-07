import { run } from '@mdx-js/mdx'
import { useEffect, useState } from 'react'
import * as runtime from 'react/jsx-runtime'
import { CustomMDXComponents } from './mdx-components'

type LoadedContentType = Awaited<ReturnType<typeof run>>['default']

export function MDXRendrr({ mdxString }: { mdxString: string }) {
  const [Content, setContent] = useState<LoadedContentType | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mdxString.trim()) {
      setContent(null)
      setError(null)
      return
    }

    const fetchContent = async () => {
      try {
        setError(null)
        const { default: loadedContent } = await run(mdxString, {
          ...runtime,
          baseUrl: import.meta.url
        })
        setContent(() => loadedContent)
      } catch (err) {
        console.error('MDX compilation error:', err)
        setError('Invalid MDX syntax. Please check your content.')
        setContent(null)
      }
    }
    fetchContent()
  }, [mdxString])

  if (error) {
    return (
      <div className='p-4 rounded-md bg-red-900/20 border border-red-500/20'>
        <p className='text-red-400 text-sm'>{error}</p>
        <details className='mt-2'>
          <summary className='text-red-300 text-xs cursor-pointer'>
            Show raw content
          </summary>
          <pre className='mt-2 p-2 bg-red-900/10 rounded text-xs text-red-200 whitespace-pre-wrap break-words'>
            {mdxString}
          </pre>
        </details>
      </div>
    )
  }

  return (
    <div>{Content ? <Content components={CustomMDXComponents} /> : null}</div>
  )
}
