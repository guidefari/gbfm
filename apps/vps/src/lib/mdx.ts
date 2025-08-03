import { compile } from '@mdx-js/mdx'
import grayMatter from 'gray-matter'

export interface MDXResult<T = Record<string, any>> {
  frontmatter: T
  content: string
  compiled: string
}

export interface MDXError {
  error: string
  details?: string
}

/**
 * Processes MDX content with gray matter frontmatter
 * @param mdxContent - Raw MDX content string
 * @returns Object with frontmatter, raw content, and compiled MDX
 */
export async function processMDX<T = Record<string, any>>(
  mdxContent: string
): Promise<MDXResult<T> | MDXError> {
  try {
    // Parse frontmatter
    const matter = grayMatter(mdxContent)

    // Compile MDX content
    const compiled = await compile(matter.content, {
      outputFormat: 'function-body'
    })

    return {
      frontmatter: matter.data as T,
      content: matter.content,
      compiled: compiled.toString()
    }
  } catch (error) {
    console.error('Error processing MDX:', error)
    return {
      error: 'Failed to process MDX content',
      details: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Type guard to check if MDX processing was successful
 */
export function isMDXResult<T>(
  result: MDXResult<T> | MDXError
): result is MDXResult<T> {
  return !('error' in result)
}

/**
 * Compiles raw markdown/MDX to function body string
 * @param content - Raw markdown/MDX content
 * @returns Compiled function body string
 */
export async function compileMDXToString(content: string): Promise<string> {
  try {
    const compiled = await compile(content, {
      outputFormat: 'function-body'
    })
    return compiled.toString()
  } catch (error) {
    console.error('Error compiling MDX:', error)
    throw new Error(
      `Failed to compile MDX: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export interface MixFrontmatter {
  title: string
  description?: string
  date?: string
  tags?: string[]
  featured?: boolean
  duration?: string
  genre?: string[]
}

export interface PostFrontmatter {
  title: string
  description?: string
  date?: string
  author?: string
  tags?: string[]
  published?: boolean
}
