import type {
  ArtworkCardModel,
  EditorialCardModel,
  IdentityCardModel,
  SocialCardFormat,
  SocialCardModel,
  TweetCardModel,
} from '@gbfm/social-card'
import { Match } from 'effect'
import type { ReactNode } from 'react'

const colors = {
  background: '#111827',
  panel: '#182235',
  foreground: '#d6fbe8',
  muted: '#769d8a',
  highlight: '#9bfd9e',
  white: '#ffffff',
} as const

const base = {
  display: 'flex',
  fontFamily: 'JetBrains Mono',
  color: colors.foreground,
} as const

const commentarySize = (length: number, format: SocialCardFormat) => {
  if (format === 'openGraph') return length > 150 ? 35 : length > 90 ? 42 : 50

  if (format === 'sleeve') return length > 200 ? 38 : length > 110 ? 46 : 54

  return length > 200 ? 42 : length > 110 ? 52 : 64
}

function Artwork({
  data,
  size,
  showMetadata = true,
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
        position: 'relative',
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
            letterSpacing: Math.max(1, size * 0.006),
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
            backgroundImage: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.92))',
          }}>
          {data.entityLabel ? (
            <div
              style={{
                ...base,
                color: 'rgba(255,255,255,0.65)',
                fontSize: size * 0.025,
                letterSpacing: size * 0.008,
                textTransform: 'uppercase',
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
              lineHeight: 1.15,
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
              fontSize: 28,
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
  format,
}: {
  readonly data: TweetCardModel
  readonly format: SocialCardFormat
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
          lineClamp: Match.value(format).pipe(
            Match.when('openGraph', () => 7),
            Match.when('poster', () => 9),
            Match.orElse(() => 8),
          ),
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
        justifyContent: 'space-between',
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
              <div
                style={{
                  ...base,
                  color: colors.muted,
                  fontSize: 18,
                  letterSpacing: 6,
                  textTransform: 'uppercase',
                }}>
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
        flexDirection: 'column',
      }}>
      <Artwork data={data} size={1080} />
      <div
        style={{
          ...base,
          height: 840,
          padding: 68,
          flexDirection: 'column',
          justifyContent: 'space-between',
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
        alignItems: 'stretch',
      }}>
      <div
        style={{
          ...base,
          width: 670,
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingRight: 54,
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
  format: SocialCardFormat,
  qrUrl: string,
): ReactNode => {
  if (format === 'poster') return <Poster data={data} qrUrl={qrUrl} />

  if (format === 'sleeve') return <Sleeve data={data} qrUrl={qrUrl} />

  return <OpenGraph data={data} />
}

function Brand() {
  return (
    <div style={{ ...base, alignItems: 'center', fontSize: 20, fontWeight: 900 }}>
      <div style={{ ...base, color: colors.highlight }}>goosebumps.</div>
      <div style={{ ...base, color: colors.muted }}>fm</div>
    </div>
  )
}

function ArtworkFallback({ label }: { readonly label: string }) {
  return (
    <div
      style={{
        ...base,
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: `linear-gradient(145deg, ${colors.panel}, #22382f)`,
        color: colors.highlight,
        fontSize: 24,
        fontWeight: 900,
        letterSpacing: 5,
      }}>
      <div style={{ ...base, textTransform: 'uppercase' }}>goosebumps</div>
      <div
        style={{
          ...base,
          marginTop: 12,
          color: colors.muted,
          fontSize: 16,
          textTransform: 'uppercase',
        }}>
        {label}
      </div>
    </div>
  )
}

function ArtworkCard({ data }: { readonly data: ArtworkCardModel }) {
  const creatorLine = data.creators.length > 0 ? data.creators.join(', ') : 'goosebumps.fm'

  return (
    <div
      style={{
        ...base,
        width: 1200,
        height: 630,
        padding: 60,
        backgroundColor: colors.background,
        justifyContent: 'space-between',
      }}>
      <div
        style={{
          ...base,
          width: 570,
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingRight: 48,
        }}>
        <Brand />
        <div style={{ ...base, flexDirection: 'column' }}>
          <div
            style={{
              ...base,
              color: colors.highlight,
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: 7,
              marginBottom: 22,
              textTransform: 'uppercase',
            }}>
            {data.eyebrow}
          </div>
          <div
            style={{
              ...base,
              color: colors.white,
              fontSize: data.title.length > 54 ? 43 : 52,
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: -2,
              lineClamp: 3,
            }}>
            {data.title}
          </div>
          <div
            style={{
              ...base,
              color: colors.muted,
              fontSize: 22,
              lineHeight: 1.35,
              marginTop: 20,
              lineClamp: 2,
            }}>
            {creatorLine}
          </div>
        </div>
        <div
          style={{
            ...base,
            color: colors.muted,
            fontSize: 15,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}>
          Listen on goosebumps.fm
        </div>
      </div>
      <div
        style={{
          ...base,
          width: 510,
          height: 510,
          overflow: 'hidden',
          border: `2px solid ${colors.muted}`,
          boxShadow: '18px 18px 0 #22382f',
        }}>
        {data.artworkUrl ? (
          <img
            src={data.artworkUrl}
            alt=''
            width={510}
            height={510}
            style={{ width: 510, height: 510, objectFit: 'cover' }}
          />
        ) : (
          <ArtworkFallback label={data.eyebrow} />
        )}
      </div>
    </div>
  )
}

function IdentityCard({ data }: { readonly data: IdentityCardModel }) {
  return (
    <div
      style={{
        ...base,
        width: 1200,
        height: 630,
        padding: 60,
        backgroundColor: colors.background,
        alignItems: 'center',
      }}>
      <div
        style={{
          ...base,
          width: 430,
          height: 430,
          flexShrink: 0,
          overflow: 'hidden',
          borderRadius: data.kind === 'profile' ? 215 : 28,
          border: `3px solid ${colors.highlight}`,
        }}>
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt=''
            width={430}
            height={430}
            style={{ width: 430, height: 430, objectFit: 'cover' }}
          />
        ) : (
          <ArtworkFallback label={data.eyebrow} />
        )}
      </div>
      <div
        style={{
          ...base,
          height: 510,
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingLeft: 70,
        }}>
        <Brand />
        <div style={{ ...base, flexDirection: 'column' }}>
          <div
            style={{
              ...base,
              color: colors.highlight,
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: 7,
              marginBottom: 18,
              textTransform: 'uppercase',
            }}>
            {data.eyebrow}
          </div>
          <div
            style={{
              ...base,
              color: colors.white,
              fontSize: data.title.length > 35 ? 45 : 57,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -2,
              lineClamp: 3,
            }}>
            {data.title}
          </div>
          <div
            style={{
              ...base,
              color: colors.foreground,
              fontSize: 19,
              lineHeight: 1.4,
              marginTop: 22,
              lineClamp: 3,
            }}>
            {data.description}
          </div>
        </div>
        <div style={{ ...base, color: colors.muted, fontSize: 17 }}>
          {data.detail ?? 'goosebumps.fm'}
        </div>
      </div>
    </div>
  )
}

function EditorialCard({ data }: { readonly data: EditorialCardModel }) {
  const attribution = [
    data.authors.length > 0 ? `By ${data.authors.join(', ')}` : null,
    data.publishedLabel,
  ]
    .filter((part) => part !== null)
    .join(' · ')

  return (
    <div
      style={{
        ...base,
        width: 1200,
        height: 630,
        padding: 60,
        backgroundColor: colors.background,
        position: 'relative',
        overflow: 'hidden',
      }}>
      {data.imageUrl ? (
        <img
          src={data.imageUrl}
          alt=''
          width={440}
          height={630}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 440,
            height: 630,
            objectFit: 'cover',
            opacity: 0.42,
          }}
        />
      ) : (
        <div
          style={{
            ...base,
            position: 'absolute',
            top: -130,
            right: -120,
            width: 520,
            height: 760,
            transform: 'rotate(18deg)',
            backgroundImage: `linear-gradient(145deg, ${colors.panel}, #22382f)`,
          }}
        />
      )}
      <div
        style={{
          ...base,
          width: 840,
          height: 510,
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          paddingRight: 70,
        }}>
        <div style={{ ...base, justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <div
            style={{
              ...base,
              color: colors.highlight,
              fontSize: 17,
              fontWeight: 900,
              letterSpacing: 7,
              textTransform: 'uppercase',
            }}>
            Editorial
          </div>
        </div>
        <div
          style={{
            ...base,
            flexDirection: 'column',
            borderLeft: `8px solid ${colors.highlight}`,
            paddingLeft: 34,
          }}>
          <div
            style={{
              ...base,
              color: colors.white,
              fontSize: data.title.length > 55 ? 44 : 55,
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: -2,
              lineClamp: 3,
            }}>
            {data.title}
          </div>
          <div
            style={{
              ...base,
              color: colors.foreground,
              fontSize: 20,
              lineHeight: 1.4,
              marginTop: 20,
              lineClamp: 2,
            }}>
            {data.description}
          </div>
        </div>
        <div style={{ ...base, color: colors.muted, fontSize: 17 }}>
          {attribution || 'goosebumps.fm'}
        </div>
      </div>
    </div>
  )
}

/** Creates the static React tree consumed by Satori for any supported card. */
export const socialCardTemplate = (
  data: SocialCardModel,
  format: SocialCardFormat,
  qrUrl: string,
): ReactNode => {
  return Match.value(data).pipe(
    Match.tag('ArtworkCard', (card) => <ArtworkCard data={card} />),
    Match.tag('IdentityCard', (card) => <IdentityCard data={card} />),
    Match.tag('EditorialCard', (card) => <EditorialCard data={card} />),
    Match.tag('TweetCard', (card) => tweetCardTemplate(card, format, qrUrl)),
    Match.exhaustive,
  )
}
