interface ShowDetailHeroImageProps {
  thumbnailUrl: string | null
  title: string
}

export function ShowDetailHeroImage({ thumbnailUrl, title }: ShowDetailHeroImageProps) {
  return (
    <img
      className='w-24 h-24 sm:w-full sm:h-auto rounded-sm object-cover shrink-0'
      src={thumbnailUrl || '/fav.png'}
      alt={`Thumbnail for ${title}`}
      width={400}
      height={400}
      loading='lazy'
    />
  )
}
