declare module 'virtual:repo-changelog' {
  import type { RichContentDocument } from '@gbfm/rich-content/schema'

  const changelog: RichContentDocument
  export default changelog
}

declare module 'virtual:gbfm-document' {
  const template: string
  export default template
}
