import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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

      const changelogPath = fileURLToPath(
        new URL('../../../CHANGELOG.md', import.meta.url)
      )

      this.addWatchFile(changelogPath)

      return `export default ${JSON.stringify(readFileSync(changelogPath, 'utf8'))}`
    }
  }
}
