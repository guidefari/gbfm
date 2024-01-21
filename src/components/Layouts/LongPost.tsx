import React from 'react'
import { PageSEO } from '../SEO'
import Image from 'next/image'
import { LilDate } from '../common/LilDate'
import { MDXcomponents } from '@/lib/mdx'
import { useMDXComponent } from 'next-contentlayer/hooks'
import { MinimalCard } from '../common/MinimalCard'
import { DEFAULT_IMAGE_URL } from '@/src/constants'

type Props = {
  content: string
  thumbnailUrl: string
  title: string
  date?: string
  description?: string
  canonicalUrl?: string
  youtubeId?: string
  mp3Url?: string
}

export const LongPost = ({
  title,
  thumbnailUrl,
  description,
  content,
  canonicalUrl,
  date,
  youtubeId,
  mp3Url,
}: Props) => {
  const MDXContent = useMDXComponent(content)
  const encoded_title = encodeURIComponent(title)
  const full_default_url = `https://goosebumps.fm/api/og?title=${encoded_title}`

  return (
    <>
      <PageSEO
        title={title}
        description={description || 'Goosebumps.fm curated sounds'}
        ogImageUrl={thumbnailUrl || full_default_url}
        canonicalUrl={canonicalUrl || null}
      />

      <div className="relative grid grid-flow-row md:grid-flow-col md:grid-cols-3 md:space-x-5">
        <div className="md:ml-2 mt-6 break-words rounded-md w-fit px-2 md:mx-auto md:max-w-[30%] md:fixed md:top-0 md:min-h-screen self-start md:col-span-1">
          {mp3Url ? (
            <MinimalCard
              title={title}
              previewUrl={mp3Url}
              imageUrl={thumbnailUrl ?? DEFAULT_IMAGE_URL}
              download
              hideTitle
            />
          ) : (
            <Image
              className="rounded-md "
              src={
                thumbnailUrl ||
                'https://res.cloudinary.com/hokaspokas/image/upload/v1663215741/goosebumpsfm/generic_Thumb.svg'
              }
              alt={`Thumbnail image for post titled - ${title}`}
              width={320}
              height={320}
              loading="lazy"
              quality={100}
            />
          )}
          <h4 className="text-left md:mx-0 text-gb-pastel-green-2">{title}</h4>
          {date && <LilDate date={date} />}
          {youtubeId && (
            <iframe
              width="100%"
              height="auto"
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}
        </div>
        <article className="min-h-screen px-2 mt-6 prose break-words md:w-auto md:px-0 md:col-start-2 md:col-span-2 text-inherit prose-a:text-inherit hover:prose-a:text-gb-tomato lg:prose-xl">
          {description && <p className="text-left ">{description}</p>}
          <MDXContent components={MDXcomponents} />
        </article>
      </div>
    </>
  )
}
