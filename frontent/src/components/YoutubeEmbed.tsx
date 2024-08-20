import React from 'react'

type Props = {
  id: string
  width?: number
  height?: number
  className?: string
}

export const YoutubeEmbed = ({ id, width, height, className }: Props) => (
  <iframe
    width={width ?? '100%'}
    height={height ?? 420}
    src={`https://www.youtube.com/embed/${id}`}
    title="YouTube video player"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
    referrerPolicy='strict-origin-when-cross-origin'
    className={`${className} my-2`}
  />
)

export default YoutubeEmbed
