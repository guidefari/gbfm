import { renderDocumentHead, type SiteMetadata } from '@gbfm/site-metadata'

/** Update only application-owned metadata after a successful client navigation, including removal of stale JSON-LD. */
export const updateDocumentHead = (metadata: SiteMetadata, noindex: boolean) => {
  document.head.querySelectorAll('[data-gbfm-metadata]').forEach((element) => element.remove())
  const head = renderDocumentHead(metadata)

  for (const entry of head.meta) {
    if ('title' in entry || ('property' in entry && entry.property === 'og:url')) continue
    const element = document.createElement('meta')
    element.setAttribute('data-gbfm-metadata', '')

    if ('name' in entry) element.name = entry.name
    else element.setAttribute('property', entry.property)
    element.content = entry.content
    document.head.append(element)
  }

  for (const script of head.scripts) {
    const element = document.createElement('script')
    element.type = script.type
    element.setAttribute('data-gbfm-metadata', '')
    element.textContent = script.children
    document.head.append(element)
  }

  if (noindex) {
    const element = document.createElement('meta')
    element.setAttribute('data-gbfm-metadata', '')
    element.name = 'robots'
    element.content = 'noindex, nofollow'
    document.head.append(element)
  }
}
