import { createHash } from 'node:crypto'
import { compile } from '@mdx-js/mdx'
import { Effect } from 'effect'

export interface MDXCompilationResult {
  compiled: string
}

export interface MDXError {
  error: string
  details?: string
}

const mdxCache = new Map<string, string>()

function contentKey(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export async function compileMDX(
  mdxContent: string
): Promise<MDXCompilationResult | MDXError> {
  const key = contentKey(mdxContent)
  const cached = mdxCache.get(key)
  if (cached !== undefined) return { compiled: cached }

  try {
    const compiled = await compile(mdxContent, {
      outputFormat: 'function-body'
    })

    const result = compiled.toString()
    mdxCache.set(key, result)
    return { compiled: result }
  } catch (error) {
    const { runAppFork } = await import('@/runtime')
    runAppFork(
      Effect.logError('[MDX] Error compiling MDX content', {
        error: error instanceof Error ? error.message : String(error)
      })
    )

    return {
      error: 'Failed to compile MDX content',
      details: error instanceof Error ? error.message : String(error)
    }
  }
}

export function isMDXCompilationResult(
  result: MDXCompilationResult | MDXError
): result is MDXCompilationResult {
  return !('error' in result)
}

export async function compileMDXToString(content: string): Promise<string> {
  const key = contentKey(content)
  const cached = mdxCache.get(key)
  if (cached !== undefined) return cached

  try {
    const compiled = await compile(content, {
      outputFormat: 'function-body'
    })
    const result = compiled.toString()
    mdxCache.set(key, result)
    return result
  } catch (error) {
    const { runAppFork } = await import('@/runtime')
    runAppFork(
      Effect.logError('[MDX] Error compiling MDX content', {
        error: error instanceof Error ? error.message : String(error)
      })
    )

    throw new Error(
      `Failed to compile MDX: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
