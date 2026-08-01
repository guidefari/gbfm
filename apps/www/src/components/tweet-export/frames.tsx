import { Music4 } from 'lucide-react'
import QRCode from 'react-qr-code'

export type TweetExportData = {
  commentary: string
  authorName: string | null
  username: string | null
  avatarUrl: string
  dateLabel: string | null
  entityLabel: string | null
  entityTitle: string | null
  entityArtists: string | null
  coverImageUrl: string | null
  url: string
}

function PostQR({ url, size }: { url: string; size: number }) {
  return (
    <div className='shrink-0 rounded-sm bg-white p-1'>
      <QRCode value={url} size={size} bgColor='#ffffff' fgColor='#111827' />
    </div>
  )
}

function CoverThumb({
  src,
  alt,
  className
}: {
  src: string | null
  alt: string
  className: string
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-muted ${className}`}>
      {src ? (
        <img src={src} alt={alt} className='h-full w-full object-cover' />
      ) : (
        <Music4 className='h-5 w-5 text-muted-foreground/60' />
      )}
    </div>
  )
}

export function PosterFrame({ data }: { data: TweetExportData }) {
  return (
    <article className='flex aspect-[4/5] w-full flex-col justify-between border border-border/60 bg-card p-7'>
      <header className='flex items-baseline justify-between font-mono text-[11px] tracking-widest text-muted-foreground'>
        {data.username ? (
          <span className='font-bold text-foreground'>@{data.username}</span>
        ) : (
          <span />
        )}
        {data.dateLabel && <span>{data.dateLabel}</span>}
      </header>

      <div className='border-l-4 border-highlight py-1 pl-5'>
        <p className='text-2xl font-bold leading-snug tracking-tight text-foreground'>
          {data.commentary}
        </p>
      </div>

      <footer className='space-y-4'>
        {data.entityTitle && (
          <div className='flex items-center gap-3'>
            <CoverThumb src={data.coverImageUrl} alt={data.entityTitle} className='h-14 w-14' />
            <div className='min-w-0'>
              {data.entityLabel && (
                <div className='text-[9px] font-bold tracking-[0.3em] text-muted-foreground/60'>
                  {data.entityLabel}
                </div>
              )}
              <div className='truncate text-base font-bold text-foreground'>{data.entityTitle}</div>
              {data.entityArtists && (
                <div className='truncate text-xs text-muted-foreground'>{data.entityArtists}</div>
              )}
            </div>
          </div>
        )}
        <div className='flex items-center justify-between border-t border-border/40 pt-3 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/60'>
          <span>goosebumps.fm</span>
          <PostQR url={data.url} size={48} />
        </div>
      </footer>
    </article>
  )
}

export function SleeveFrame({ data }: { data: TweetExportData }) {
  return (
    <article className='w-full overflow-hidden border border-border/60 bg-card'>
      <div className='relative aspect-square w-full bg-vinyl-rings bg-muted/40'>
        {data.coverImageUrl ? (
          <img
            src={data.coverImageUrl}
            alt={data.entityTitle ?? ''}
            className='h-full w-full object-cover'
          />
        ) : (
          <div className='flex h-full w-full items-center justify-center'>
            <Music4 className='h-16 w-16 text-muted-foreground/40' />
          </div>
        )}
        {data.entityTitle && (
          <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-5 pb-4 pt-16'>
            {data.entityLabel && (
              <div className='text-[10px] font-bold tracking-[0.35em] text-white/60'>
                {data.entityLabel}
              </div>
            )}
            <div className='text-xl font-black leading-tight tracking-tight text-white'>
              {data.entityTitle}
            </div>
            {data.entityArtists && (
              <div className='text-base text-white/70'>{data.entityArtists}</div>
            )}
          </div>
        )}
      </div>

      <div className='space-y-4 px-5 py-5'>
        <p className='text-lg leading-relaxed text-foreground'>{data.commentary}</p>

        <div className='flex items-center justify-between gap-3 border-t border-border/40 pt-4'>
          <div className='flex min-w-0 items-center gap-3'>
            <img
              src={data.avatarUrl}
              alt=''
              className='h-8 w-8 rounded-sm object-cover ring-1 ring-border/60'
            />
            <div className='min-w-0 font-mono text-[11px] tracking-wider text-muted-foreground'>
              <div className='truncate'>
                {data.authorName && (
                  <span className='font-bold text-foreground'>{data.authorName}</span>
                )}
                {data.username && <span> · @{data.username}</span>}
                {data.dateLabel && <span> · {data.dateLabel}</span>}
              </div>
              <div className='truncate text-[10px] tracking-[0.3em] text-muted-foreground/60'>
                goosebumps.fm
              </div>
            </div>
          </div>
          <PostQR url={data.url} size={44} />
        </div>
      </div>
    </article>
  )
}
