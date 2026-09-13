import type { ReactNode } from 'react'
import type { TweetCardFormat, TweetCardModel } from '@gbfm/tweet-card'

const colors = {
  background: '#111827',
  panel: '#182235',
  foreground: '#d6fbe8',
  muted: '#769d8a',
  highlight: '#9bfd9e',
  white: '#ffffff'
} as const

const base = {
  display: 'flex',
  fontFamily: 'JetBrains Mono',
  color: colors.foreground
} as const

const commentarySize = (length: number, format: TweetCardFormat) => {
  if (format === 'openGraph') return length > 150 ? 35 : length > 90 ? 42 : 50
  if (format === 'sleeve') return length > 200 ? 38 : length > 110 ? 46 : 54
  return length > 200 ? 42 : length > 110 ? 52 : 64
}

function Artwork({
  data,
  size,
  showMetadata = true
}: {
  readonly data: TweetCardModel
  readonly size: number
  readonly showMetadata?: boolean
}) {
  return (
    <div
      style={{
        ...base,
        width: size,
        height: size,
        flexShrink: 0,
        backgroundImage: `linear-gradient(145deg, ${colors.panel}, #22382f)`,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative'
      }}>
      {data.coverImageUrl ? (
        <img
          src={data.coverImageUrl}
          alt={data.entityTitle ?? ''}
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: 'cover' }}
        />
      ) : (
        <div
          style={{
            ...base,
            flexDirection: 'column',
            alignItems: 'center',
            color: colors.highlight,
            fontWeight: 900,
            fontSize: Math.max(18, size * 0.07),
            letterSpacing: Math.max(1, size * 0.006)
          }}>
          <div style={base}>goosebumps.</div>
          <div style={{ ...base, color: colors.muted }}>fm</div>
        </div>
      )}
      {showMetadata && data.entityTitle ? (
        <div
          style={{
            ...base,
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            flexDirection: 'column',
            padding: size * 0.06,
            paddingTop: size * 0.17,
            backgroundImage: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.92))'
          }}>
          {data.entityLabel ? (
            <div
              style={{
                ...base,
                color: 'rgba(255,255,255,0.65)',
                fontSize: size * 0.025,
                letterSpacing: size * 0.008
              }}>
              {data.entityLabel}
            </div>
          ) : null}
          <div
            style={{
              ...base,
              color: colors.white,
              fontWeight: 900,
              fontSize: size * 0.05,
              lineHeight: 1.15
            }}>
            {data.entityTitle}
          </div>
          {data.entityArtists ? (
            <div style={{ ...base, color: 'rgba(255,255,255,0.75)', fontSize: size * 0.032 }}>
              {data.entityArtists}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Author({ data, qrUrl }: { readonly data: TweetCardModel; readonly qrUrl: string }) {
  const byline = [data.authorName, data.username ? `@${data.username}` : null, data.dateLabel]
    .filter((part) => part !== null)
    .join(' · ')

  return (
    <div style={{ ...base, width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ ...base, alignItems: 'center', minWidth: 0 }}>
        {data.avatarUrl ? (
          <img
            src={data.avatarUrl}
            alt=''
            width={64}
            height={64}
            style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, marginRight: 20 }}
          />
        ) : (
          <div
            style={{
              ...base,
              width: 64,
              height: 64,
              marginRight: 20,
              borderRadius: 8,
              backgroundColor: colors.highlight,
              color: colors.background,
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 28
            }}>
            G
          </div>
        )}
        <div style={{ ...base, flexDirection: 'column', minWidth: 0 }}>
          <div style={{ ...base, fontSize: 20, fontWeight: 900 }}>{byline}</div>
          <div style={{ ...base, fontSize: 17, color: colors.muted, letterSpacing: 4 }}>
            goosebumps.fm
          </div>
        </div>
      </div>
      <img
        src={qrUrl}
        alt='QR code for this tweet'
        width={92}
        height={92}
        style={{ width: 92, height: 92, marginLeft: 24 }}
      />
    </div>
  )
}

function Commentary({
  data,
  format
}: {
  readonly data: TweetCardModel
  readonly format: TweetCardFormat
}) {
  return (
    <div style={{ ...base, borderLeft: `8px solid ${colors.highlight}`, paddingLeft: 34 }}>
      <div
        style={{
          ...base,
          fontSize: commentarySize(data.commentary.length, format),
          fontWeight: 900,
          lineHeight: 1.28,
          letterSpacing: -1.5,
          lineClamp: format === 'openGraph' ? 7 : format === 'poster' ? 9 : 8
        }}>
        {data.commentary}
      </div>
    </div>
  )
}

function Poster({ data, qrUrl }: { readonly data: TweetCardModel; readonly qrUrl: string }) {
  return (
    <div
      style={{
        ...base,
        width: 1080,
        height: 1350,
        padding: 78,
        backgroundColor: colors.background,
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
      <div style={{ ...base, justifyContent: 'space-between', color: colors.muted, fontSize: 22 }}>
        <div style={{ ...base, color: colors.highlight, fontWeight: 900 }}>
          {data.username ? `@${data.username}` : 'goosebumps.fm'}
        </div>
        <div style={base}>{data.dateLabel}</div>
      </div>
      <Commentary data={data} format='poster' />
      <div style={{ ...base, flexDirection: 'column' }}>
        {data.entityTitle ? (
          <div style={{ ...base, alignItems: 'center', marginBottom: 34 }}>
            <Artwork data={data} size={150} showMetadata={false} />
            <div style={{ ...base, flexDirection: 'column', marginLeft: 28 }}>
              <div style={{ ...base, color: colors.muted, fontSize: 18, letterSpacing: 6 }}>
                {data.entityLabel}
              </div>
              <div style={{ ...base, fontSize: 32, fontWeight: 900 }}>{data.entityTitle}</div>
              <div style={{ ...base, fontSize: 23, color: colors.muted }}>{data.entityArtists}</div>
            </div>
          </div>
        ) : null}
        <div style={{ ...base, borderTop: `2px solid ${colors.muted}`, paddingTop: 30 }}>
          <Author data={data} qrUrl={qrUrl} />
        </div>
      </div>
    </div>
  )
}

function Sleeve({ data, qrUrl }: { readonly data: TweetCardModel; readonly qrUrl: string }) {
  return (
    <div
      style={{
        ...base,
        width: 1080,
        height: 1920,
        backgroundColor: colors.background,
        flexDirection: 'column'
      }}>
      <Artwork data={data} size={1080} />
      <div
        style={{
          ...base,
          height: 840,
          padding: 68,
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
        <Commentary data={data} format='sleeve' />
        <div style={{ ...base, borderTop: `2px solid ${colors.muted}`, paddingTop: 34 }}>
          <Author data={data} qrUrl={qrUrl} />
        </div>
      </div>
    </div>
  )
}

function OpenGraph({ data }: { readonly data: TweetCardModel }) {
  return (
    <div
      style={{
        ...base,
        width: 1200,
        height: 630,
        padding: 60,
        backgroundColor: colors.background,
        alignItems: 'stretch'
      }}>
      <div
        style={{
          ...base,
          width: 670,
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingRight: 54
        }}>
        <div style={{ ...base, color: colors.highlight, fontSize: 22, fontWeight: 900 }}>
          goosebumps.fm
        </div>
        <Commentary data={data} format='openGraph' />
        <div style={{ ...base, flexDirection: 'column' }}>
          <div style={{ ...base, fontSize: 20, fontWeight: 900 }}>
            {data.authorName ?? (data.username ? `@${data.username}` : 'goosebumps.fm')}
          </div>
          <div style={{ ...base, fontSize: 17, color: colors.muted }}>{data.dateLabel}</div>
        </div>
      </div>
      <Artwork data={data} size={510} />
    </div>
  )
}

/** Creates the static React tree consumed by Satori for a requested format. */
export const tweetCardTemplate = (
  data: TweetCardModel,
  format: TweetCardFormat,
  qrUrl: string
): ReactNode => {
  if (format === 'poster') return <Poster data={data} qrUrl={qrUrl} />
  if (format === 'sleeve') return <Sleeve data={data} qrUrl={qrUrl} />
  return <OpenGraph data={data} />
}
