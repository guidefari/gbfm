import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { LilDate } from '../common/LilDate'
import { MinimalCard } from '../common/MinimalCard'
import { MDXRendrr } from '../MDXRendrr'

type Props = {
  content: string
  thumbnailUrl: string
  title: string
  date?: string | Date
  description?: string
  youtubeId?: string
  mp3Url?: string
  slug?: string
}

export const LongPost = ({
  title,
  thumbnailUrl,
  description,
  content,
  date,
  youtubeId,
  mp3Url,
  slug
}: Props) => {
  const shareUrl = slug
    ? `https://vps.goosebumps.fm/share/mix/${slug}`
    : undefined

  return (
    <div className='relative grid grid-flow-row lg:grid-flow-col lg:grid-cols-[auto_1fr] lg:gap-5'>
      <div className='px-2 mt-6 break-words rounded-md w-fit lg:mx-auto lg:sticky lg:top-6 lg:self-start lg:col-span-1'>
        {mp3Url ? (
          <MinimalCard
            title={title}
            previewUrl={mp3Url}
            imageUrl={thumbnailUrl ?? DEFAULT_IMAGE_URL}
            download
            hideTitle
            shareUrl={shareUrl}
          />
        ) : (
          <img
            className='rounded-md'
            src={thumbnailUrl || DEFAULT_IMAGE_URL}
            alt={`Thumbnail for post titled - ${title}`}
            width={320}
            height={320}
            loading='lazy'
          />
        )}
        <h4 className='text-left lg:mx-0 text-gb-pastel-green-2'>{title}</h4>
        {date && <LilDate date={date} />}
        {youtubeId && (
          <iframe
            width='100%'
            height='auto'
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title='YouTube video player'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            allowFullScreen
          />
        )}
      </div>
      <article className='min-h-screen px-2 mt-6 break-words lg:w-auto lg:px-0 lg:col-span-2'>
        {description && <p className='text-left'>{description}</p>}
        <MDXRendrr mdxString={content} />
      </article>
    </div>
  )
}
