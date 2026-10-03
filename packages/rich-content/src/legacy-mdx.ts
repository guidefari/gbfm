/* oxlint-disable anti-slop/no-unknown-returns, anti-slop/no-runtime-typeof, anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type, anti-slop/no-array-filter-map -- This migration adapter exhaustively narrows ESTree literal values before returning domain values. */
import { createProcessor } from '@mdx-js/mdx'
import { parseFragment } from 'parse5'

export interface LegacyConversion {
  readonly canonical: string
  readonly component: string
}

export interface LegacyConversionFailure {
  readonly reason: string
}

export type LegacyConversionResult = LegacyConversion | LegacyConversionFailure

type Estree = {
  type: string
  value?: unknown
  elements?: Array<Estree | null>
  expressions?: Array<Estree>
  quasis?: Array<{ value?: { cooked?: string; raw?: string } }>
  body?: Array<{ expression?: Estree }>
}

type Attribute = {
  type: string
  name?: string
  value?: string | { type: string; value?: string; data?: { estree?: Estree } } | null
}

type MdxNode = {
  type: string
  name?: string
  attributes?: Array<Attribute>
  children?: Array<MdxNode>
  value?: string
  data?: { estree?: Estree }
}

const processor = createProcessor()

const quote = (value: string) =>
  `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n')}"`

const expressionValue = (node: { data?: { estree?: Estree } }): unknown => {
  const expression = node.data?.estree?.body?.[0]?.expression

  if (!expression) return undefined

  if (
    expression.type === 'Literal' &&
    ['string', 'number', 'boolean'].includes(typeof expression.value)
  )
    return expression.value

  if (
    expression.type === 'ArrayExpression' &&
    expression.elements?.every((item) => item?.type === 'Literal' && typeof item.value === 'string')
  )
    return expression.elements.map((item) => item?.value)

  if (
    expression.type === 'TemplateLiteral' &&
    expression.expressions?.length === 0 &&
    expression.quasis?.length === 1
  )
    return expression.quasis[0]?.value?.cooked ?? expression.quasis[0]?.value?.raw

  return undefined
}

const properties = (node: MdxNode): Record<string, unknown> | null => {
  const result: Record<string, unknown> = {}

  for (const attribute of node.attributes ?? []) {
    if (attribute.type !== 'mdxJsxAttribute' || !attribute.name || attribute.name.startsWith('on'))
      return null

    if (attribute.value === null || attribute.value === undefined) result[attribute.name] = true
    else if (typeof attribute.value === 'string') result[attribute.name] = attribute.value
    else {
      const value = expressionValue(attribute.value)

      if (value === undefined) return null
      result[attribute.name] = value
    }
  }

  return result
}

const only = (props: Record<string, unknown>, allowed: ReadonlyArray<string>) =>
  Object.keys(props).every((key) => allowed.includes(key))

const string = (value: unknown) => (typeof value === 'string' ? value : null)

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)

const stringList = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null

const spotifyUrl = (entityType: 'track' | 'album' | 'playlist', value: string) =>
  /^[A-Za-z0-9]{22}$/.test(value) ? `https://open.spotify.com/${entityType}/${value}` : value

const attrs = (values: ReadonlyArray<readonly [string, string | boolean | null]>) =>
  values
    .filter((entry) => entry[1] !== null)
    .map(([name, value]) => `${name}=${quote(String(value))}`)
    .join(' ')

const iframeSource = (node: MdxNode) => {
  let source: string | null = null

  for (const attribute of node.attributes ?? []) {
    if (attribute.type !== 'mdxJsxAttribute' || !attribute.name || attribute.name.startsWith('on'))
      return null

    if (attribute.name !== 'src') continue

    if (typeof attribute.value === 'string') source = attribute.value
    else if (attribute.value && typeof expressionValue(attribute.value) === 'string')
      source = string(expressionValue(attribute.value))
    else return null
  }

  return source
}

const iframe = (node: MdxNode): LegacyConversionResult => {
  const source = iframeSource(node)

  if (!source) return { reason: 'Iframe requires a literal src attribute' }
  let url: URL

  try {
    url = new URL(source)
  } catch {
    return { reason: 'Iframe src is malformed' }
  }

  const host = url.hostname.toLowerCase()
  const parts = url.pathname.split('/').filter(Boolean)

  if (host === 'open.spotify.com' && parts[0] === 'embed') {
    const entityType = parts[1]
    const id = parts[2]

    if (id && (entityType === 'track' || entityType === 'album' || entityType === 'playlist'))
      return {
        component: 'iframe',
        canonical: `::${entityType}{url=${quote(`https://open.spotify.com/${entityType}/${id}`)}}`,
      }

    if (id && (entityType === 'episode' || entityType === 'show'))
      return {
        component: 'iframe',
        canonical: `::media{url=${quote(`https://open.spotify.com/${entityType}/${id}`)}}`,
      }
  }

  if (host === 'w.soundcloud.com') {
    const canonical = url.searchParams.get('url')

    if (canonical) return { component: 'iframe', canonical: `::media{url=${quote(canonical)}}` }
  }

  if (
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'www.youtube-nocookie.com' ||
    host === 'bandcamp.com'
  )
    return { component: 'iframe', canonical: `::media{url=${quote(url.href)}}` }

  if (host === 'embed.music.apple.com')
    return { component: 'iframe', canonical: `[Open on Apple Music](${url.href})` }

  if (host === 'embed.tidal.com')
    return { component: 'iframe', canonical: `[Open on Tidal](${url.href})` }

  return { reason: 'Iframe provider is unsupported' }
}

type HtmlNode = {
  readonly nodeName: string
  readonly attrs?: ReadonlyArray<{ readonly name: string; readonly value: string }>
  readonly childNodes?: ReadonlyArray<HtmlNode>
}

const rawIframe = (source: string): LegacyConversionResult => {
  // SAFETY: parse5's parsed fragment is traversed through its documented nodeName,
  // attrs, and childNodes fields. All other parser-owned fields remain opaque.
  // oxlint-disable-next-line typescript/consistent-type-assertions, typescript/no-unsafe-type-assertion, anti-slop/require-safety-comment-for-type-assertion
  const fragment = parseFragment(source) as HtmlNode
  const elements = (fragment.childNodes ?? []).filter((node) => node.nodeName !== '#text')
  const element = elements[0]

  if (elements.length !== 1 || element?.nodeName !== 'iframe')
    return { reason: 'Expected one legacy iframe element' }
  const src = element.attrs?.find((attribute) => attribute.name === 'src')?.value

  return iframe({
    type: 'mdxJsxFlowElement',
    name: 'iframe',
    attributes: [{ type: 'mdxJsxAttribute', name: 'src', value: src ?? null }],
  })
}

const plainText = (node: MdxNode): string => {
  if (node.type === 'text') return node.value ?? ''

  if (node.type === 'mdxTextExpression') {
    const value = expressionValue(node)

    return typeof value === 'string' ? value : ''
  }

  return (node.children ?? []).map(plainText).join('')
}

const convertNode = (node: MdxNode): LegacyConversionResult => {
  const name = node.name ?? ''

  if (name === 'iframe') return iframe(node)

  if (name === 'hr') return { component: name, canonical: '---' }

  if (name === 'br') return { component: name, canonical: '  \n' }

  if (name === 'div') {
    const meaningfulChildren = (node.children ?? []).filter(
      (child) => child.type !== 'text' || child.value?.trim(),
    )

    const converted = meaningfulChildren.map(convertNode)

    if (converted.length === 0 || converted.some((item) => 'reason' in item)) {
      const text = plainText(node).trim()

      return text
        ? { component: name, canonical: text }
        : { reason: 'Div wrapper requires static content' }
    }

    return {
      component: name,
      canonical: converted.map((item) => ('canonical' in item ? item.canonical : '')).join('\n\n'),
    }
  }

  const props = properties(node)

  if (!props) return { reason: 'Only literal attributes are allowed' }

  if (name === 'Track' || name === 'Album' || name === 'Playlist') {
    if (Object.keys(props).length === 0)
      return { component: name, canonical: '*Music embed unavailable.*' }

    if (!only(props, ['url', 'genres', 'blurb', 'tracks']) || !string(props.url))
      return { reason: `Invalid ${name} props` }
    const genreValues = props.genres === undefined ? [] : stringList(props.genres)

    if (!genreValues) return { reason: 'genres must be a string array' }
    let directive: 'track' | 'album' | 'playlist' = 'playlist'

    if (name === 'Track') directive = 'track'
    else if (name === 'Album') directive = 'album'

    return {
      component: name,
      canonical: `::${directive}{${attrs([
        ['url', spotifyUrl(directive, string(props.url) ?? '')],
        ['genres', genreValues.join(', ') || null],
        ['blurb', string(props.blurb)],
        ['tracks', props.tracks === undefined ? null : bool(props.tracks, true)],
      ])}}`,
    }
  }

  if (name === 'MusicEntity') {
    if (
      !only(props, ['type', 'id', 'showTracks', 'tracks']) ||
      !['track', 'album', 'playlist'].includes(string(props.type) ?? '') ||
      !string(props.id)
    )
      return { reason: 'Invalid MusicEntity props' }

    return {
      component: name,
      canonical: `::music{${attrs([
        ['type', string(props.type)],
        ['id', string(props.id)],
        ['tracks', bool(props.showTracks ?? props.tracks, true)],
      ])}}`,
    }
  }

  if (name === 'YoutubeEmbed') {
    if (!only(props, ['videoId', 'id']) || !string(props.videoId ?? props.id))
      return { reason: 'Invalid YoutubeEmbed props' }

    return {
      component: name,
      canonical: `::media{url=${quote(`https://www.youtube.com/watch?v=${string(props.videoId ?? props.id)}`)}}`,
    }
  }

  if (name === 'ExternalMedia') {
    if (!only(props, ['url', 'provider']) || !string(props.url))
      return { reason: 'Invalid ExternalMedia props' }
    let url: URL

    try {
      url = new URL(string(props.url) ?? '')
    } catch {
      return { reason: 'ExternalMedia URL is malformed' }
    }

    const provider =
      url.hostname.includes('youtube') || url.hostname === 'youtu.be'
        ? 'youtube'
        : url.hostname.includes('soundcloud')
          ? 'soundcloud'
          : url.hostname.includes('bandcamp')
            ? 'bandcamp'
            : url.hostname === 'open.spotify.com'
              ? 'spotify'
              : null

    if (!provider || (props.provider !== undefined && props.provider !== provider))
      return { reason: 'Provider does not match URL' }

    return { component: name, canonical: `::media{url=${quote(url.href)}}` }
  }

  if (name === 'Tracklist') {
    if (!only(props, ['tracks']) || !stringList(props.tracks))
      return { reason: 'Tracklist requires a literal string array' }

    return {
      component: name,
      canonical: `:::tracklist\n${stringList(props.tracks)
        ?.map((track) => `- ${track}`)
        .join('\n')}\n:::`,
    }
  }

  if (name === 'HorizontalScrollCards') {
    if (
      !only(props, []) ||
      !(node.children ?? []).every((child) => child.type === 'mdxJsxFlowElement')
    )
      return { reason: 'Cards require static embed children' }
    const converted = (node.children ?? []).map(convertNode)

    if (converted.some((item) => 'reason' in item))
      return { reason: 'A card child could not be converted' }

    return {
      component: name,
      canonical: `:::cards\n${converted.map((item) => ('canonical' in item ? item.canonical : '')).join('\n')}\n:::`,
    }
  }

  return { reason: `Unknown legacy component: ${name}` }
}

export const convertLegacyMdxFragment = (fragment: string): LegacyConversionResult => {
  try {
    const tree = processor.parse(fragment)
    // SAFETY: createProcessor.parse returns mdast/MDX nodes; conversion checks every consumed discriminant.
    // oxlint-disable-next-line typescript/consistent-type-assertions, typescript/no-unsafe-type-assertion, anti-slop/require-safety-comment-for-type-assertion
    const children = tree.children as Array<MdxNode>

    if (children.length === 1 && children[0]?.type === 'html')
      return rawIframe(children[0].value ?? '')

    if (
      children.length === 1 &&
      children[0]?.type === 'paragraph' &&
      children[0].children?.length === 1 &&
      children[0].children[0]?.type === 'mdxJsxTextElement'
    )
      return convertNode(children[0].children[0])

    if (children.length !== 1 || children[0]?.type !== 'mdxJsxFlowElement')
      return { reason: 'Expected one block-level legacy component' }

    return convertNode(children[0])
  } catch {
    return { reason: 'Malformed legacy component' }
  }
}
