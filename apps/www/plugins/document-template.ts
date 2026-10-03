import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import type { Plugin, ViteDevServer } from 'vite'

/** Captures Vite's hashed client shell for the request-time document renderer. */
export const documentTemplate = (): Plugin => {
  let template = ''
  let server: ViteDevServer | undefined
  return {
    name: 'gbfm-document-template',
    sharedDuringBuild: true,
    configureServer(value) {
      server = value
    },
    resolveId(id) {
      return id === 'virtual:gbfm-document' ? '\0virtual:gbfm-document' : undefined
    },
    async load(id) {
      if (id !== '\0virtual:gbfm-document') return undefined
      this.addWatchFile(fileURLToPath(new URL('../index.html', import.meta.url)))
      const source = server
        ? await server.transformIndexHtml(
            '/',
            await readFile(new URL('../index.html', import.meta.url), 'utf8'),
          )
        : template
      if (!source) throw new Error('Build the client document before the server renderer')
      return `export default ${JSON.stringify(source)}`
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const document = bundle['index.html']
        if (document?.type === 'asset') template = String(document.source)
      },
    },
  }
}
