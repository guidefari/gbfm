import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { RichContentDocument } from '@gbfm/rich-content/schema'
import { parseRichContent } from '@gbfm/rich-content/source'
import { Schema } from 'effect'
import type { Plugin } from 'vite'

export function repoChangelogPlugin(): Plugin {
  return {
    name: 'repo-changelog',
    resolveId(id) {
      return id === 'virtual:repo-changelog' ? id : null
    },
    load(id) {
      if (id !== 'virtual:repo-changelog') {
        return null
      }

      const changelogPath = fileURLToPath(new URL('../../../CHANGELOG.md', import.meta.url))

      this.addWatchFile(changelogPath)

      const parsed = parseRichContent(readFileSync(changelogPath, 'utf8'), {
        sourceBytes: 1024 * 1024,
        blocks: 10_000,
      })

      if (parsed.diagnostics.length > 0)
        throw new Error(
          `CHANGELOG.md contains unsupported rich content: ${parsed.diagnostics.map((diagnostic) => diagnostic.message).join('; ')}`,
        )

      const document = Schema.decodeUnknownSync(RichContentDocument)(parsed.document)

      return `export default ${JSON.stringify(document)}`
    },
  }
}
