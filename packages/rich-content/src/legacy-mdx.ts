/* oxlint-disable anti-slop/no-unknown-returns, anti-slop/no-runtime-typeof, anti-slop/no-unknown-parameters, anti-slop/no-unsafe-dictionary-type, anti-slop/no-array-filter-map -- This migration adapter exhaustively narrows ESTree literal values before returning domain values. */
import { createProcessor } from '@mdx-js/mdx'

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

const convertNode = (node: MdxNode): LegacyConversionResult => {
  const name = node.name ?? ''
  const props = properties(node)

  if (!props) return { reason: 'Only literal attributes are allowed' }

  if (name === 'Track' || name === 'Album' || name === 'Playlist') {
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

    if (children.length !== 1 || children[0]?.type !== 'mdxJsxFlowElement')
      return { reason: 'Expected one block-level legacy component' }

    return convertNode(children[0])
  } catch {
    return { reason: 'Malformed legacy component' }
  }
}
