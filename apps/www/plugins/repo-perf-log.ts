import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

export function repoPerfLogPlugin(): Plugin {
  return {
    name: 'repo-perf-log',
    resolveId(id) {
      return id === 'virtual:repo-perf-log' ? id : null
    },
    load(id) {
      if (id !== 'virtual:repo-perf-log') {
        return null
      }

      const perfLogPath = fileURLToPath(new URL('../../../docs/PERF_LOG.md', import.meta.url))

      this.addWatchFile(perfLogPath)

      return `export default ${JSON.stringify(readFileSync(perfLogPath, 'utf8'))}`
    }
  }
}
