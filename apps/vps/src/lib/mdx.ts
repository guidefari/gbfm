import { compile } from '@mdx-js/mdx'

export interface MDXCompilationResult {
  compiled: string
}

export interface MDXError {
  error: string
  details?: string
}

/**
 * Compiles MDX content to executable function body
 * @param mdxContent - Raw MDX content string (without frontmatter)
 * @returns Compiled MDX or error
 */
export async function compileMDX(
  mdxContent: string
): Promise<MDXCompilationResult | MDXError> {
  try {
    const compiled = await compile(mdxContent, {
      outputFormat: 'function-body'
    })

    return {
      compiled: compiled.toString()
    }
  } catch (error) {
    console.error('Error compiling MDX:', error)
    return {
      error: 'Failed to compile MDX content',
      details: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Type guard to check if MDX compilation was successful
 */
export function isMDXCompilationResult(
  result: MDXCompilationResult | MDXError
): result is MDXCompilationResult {
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
