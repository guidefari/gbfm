import { useFeatureFlag } from '@gbfm/core/feature-flags'
import { toast } from '@gbfm/ui'
import { Download, Share } from 'lucide-react'
import type React from 'react'
import { Artwork } from '@/components/common/Artwork'
import { copyToClipboard } from '@/lib/utils'
import { log } from '@/services/logger'

// this component needs to support:
// stream link to spotify
// stream link to bandcamp
// mp3 download link for self hosted mp3

interface Props {
  title: string
  artists?: string
  blurb?: string
  imageUrl: string
  genres?: string[] | null
  loading?: boolean
  downloadUrl?: string
  trackUrl?: string
  children?: React.ReactNode
  download?: boolean
  className?: string
  hideTitle?: boolean
  shareUrl?: string
}

export const MinimalCard: React.FC<Props> = ({
  title,
  blurb,
  imageUrl,
  genres,
  loading,
  downloadUrl,
  trackUrl,
  children,
  artists,
  download = false,
  className,
  hideTitle,
  shareUrl
}) => {
  const isShareEnabled = useFeatureFlag('ui.share')

  const constructUrl = () => {
    if (!downloadUrl) return
    const safeTitle = encodeURIComponent(title)
    const safeDlUrl = encodeURIComponent(downloadUrl)
    return `/api/dl?fileUrl=${safeDlUrl}&title=${safeTitle}`
  }

  const handleShare = async () => {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({
        title: 'Link copied!',
        description: 'Share URL copied to clipboard'
      })
    } catch (error) {
      log('error', 'Failed to copy link to clipboard', { shareUrl, error })
      toast({
        title: 'Failed to copy',
        description: 'Could not copy link to clipboard',
        variant: 'destructive'
      })
    }
  }

  const artistsAndTitle = `${artists ?? null} ${' - '} ${title ?? null}`

  return (
    <div
      className={`not-prose relative z-10 min-w-64 shrink-0 overflow-hidden max-w-md my-8 border-2 border-t-0 border-l-0 rounded-md md:max-w-xs border-gb-tomato ${className}`}>
      <div className='relative shrink-0 mb-4 sm:mb-0 sm:mr-4 group'>
        {trackUrl ? (
          <a
            href={trackUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='block transition-opacity hover:opacity-80'>
            <Artwork
              src={imageUrl}
              alt={title}
              radius='md'
              border='none'
              isLoading={loading}
              className='w-full'
              width={300}
              height={300}
            />
          </a>
        ) : (
          <Artwork
            src={imageUrl}
            alt={title}
            radius='md'
            border='none'
            isLoading={loading}
            className='w-full'
            width={300}
            height={300}
          />
        )}
      </div>
      <div className='p-3'>
        {genres && genres.length > 0 && (
          <div className='flex flex-wrap space-x-2'>
            {genres.map((genre) => (
              <span key={genre} className='p-1 px-2 text-base rounded-sm bg-gb-darker-bg'>
                {genre}
              </span>
            ))}
          </div>
        )}

        {((download && downloadUrl) || (isShareEnabled && shareUrl)) && (
          <div className='flex my-2 space-x-3 align-bottom '>
            {download && downloadUrl && (
              <a type='button' title='Download' href={constructUrl()}>
                <Download className='py-0.5 default-icon' />
              </a>
            )}
            {isShareEnabled && shareUrl && (
              <button
                type='button'
                title='Share'
                onClick={handleShare}
                className='shrink-0 p-1 transition-colors rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-highlight'>
                <Share className='w-5 h-5 text-foreground/60 hover:text-foreground' />
              </button>
            )}
          </div>
        )}

        {!hideTitle && (
          <div className='mt-3 text-base font-medium leading-6'>
            {trackUrl ? (
              <a
                href={trackUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='hover:text-gb-tomato hover:underline'>
                {artistsAndTitle}
              </a>
            ) : (
              <button onClick={() => copyToClipboard(artistsAndTitle)} tabIndex={0} type='button'>
                {artistsAndTitle}
              </button>
            )}
          </div>
        )}
        {(blurb || children) && (
          <hr className='mx-10 my-4 border-b-2 rounded-sm border-gb-pastel-green-2' />
        )}
        <div className='mt-2 '>{children || blurb || <br />}</div>
      </div>
    </div>
  )
}
