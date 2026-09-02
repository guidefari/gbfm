import { useEffect, useState } from 'react'
import {
  bandcampOembedUrl,
  externalMediaEmbed,
  externalMediaProviders,
  parseBandcampOembedJson,
  parseExternalMediaUrl,
  type ExternalMediaEmbed,
  type ExternalMediaReference
} from './external-media'

type ExternalMediaProps = {
  provider: string
  url: string
}

type ResolvedExternalMediaProps = {
  media: ExternalMediaReference
}

/** Renders a safe provider-owned iframe from a normalized editorial media reference. */
export function ExternalMedia({ provider, url }: ExternalMediaProps) {
  const parsed = parseExternalMediaUrl(url)
  if (!parsed.ok || parsed.media.provider !== provider) return null

  if (parsed.media.provider === externalMediaProviders.bandcamp) {
    return <BandcampExternalMedia media={parsed.media} />
  }

  const embed = externalMediaEmbed(parsed.media)
  return embed === null ? null : <ExternalMediaFrame embed={embed} />
}

function BandcampExternalMedia({ media }: ResolvedExternalMediaProps) {
  const [resolved, setResolved] = useState<ExternalMediaReference | null>(null)
  const [failed, setFailed] = useState(false)
  const oembedUrl = bandcampOembedUrl(media)

  useEffect(() => {
    setResolved(null)
    setFailed(false)

    if (oembedUrl === null) {
      setResolved(media)
      return undefined
    }

    const controller = new AbortController()

    void fetch(oembedUrl, { signal: controller.signal })
      .then(async (response) => (response.ok ? response.text() : null))
      .then((response) => {
        if (controller.signal.aborted) return
        if (response === null) {
          setFailed(true)
          return
        }

        const parsed = parseBandcampOembedJson(response)
        if (parsed.ok) setResolved(parsed.media)
        else setFailed(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })

    return () => controller.abort()
  }, [media, oembedUrl])

  const embed = resolved === null ? null : externalMediaEmbed(resolved)
  if (embed !== null) return <ExternalMediaFrame embed={embed} />

  return (
    <p className='not-prose text-sm text-muted-foreground'>
      {failed ? (
        <a href={media.url} target='_blank' rel='noreferrer' className='underline'>
          Listen on Bandcamp
        </a>
      ) : (
        'Loading Bandcamp player...'
      )}
    </p>
  )
}

function ExternalMediaFrame({ embed }: { embed: ExternalMediaEmbed }) {
  return (
    <div className='not-prose my-4 overflow-hidden rounded-sm border border-border/60 bg-muted/20'>
      <iframe
        src={embed.src}
        title={embed.title}
        width='100%'
        height={embed.height}
        loading='lazy'
        allow={embed.allow}
        allowFullScreen={embed.provider === externalMediaProviders.youtube}
        referrerPolicy='strict-origin-when-cross-origin'
        className='block border-0'
      />
    </div>
  )
}
