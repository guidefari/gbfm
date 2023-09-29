import React from 'react'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { useAudioPlayerContext } from '../contexts/AudioPlayer'
import { DEFAULT_IMAGE_URL } from '../constants'

type PlayPauseButtonProps = {
  url: string
  thumbnailUrl?: string
}

export const PlayPauseButton = ({ url, thumbnailUrl }: PlayPauseButtonProps) => {
  const [audioRef, { handleAlbumArtClick }, isPlaying] = useAudioPlayerContext()

  const handleClick = () => handleAlbumArtClick(url, thumbnailUrl || DEFAULT_IMAGE_URL)

  if (url !== audioRef?.src) return <GiPlayButton className="default-icon" onClick={handleClick} />
  if (!isPlaying && url == audioRef?.src)
    return <GiPlayButton className="default-icon" onClick={handleClick} />
  if (isPlaying && url == audioRef?.src)
    return <GiPauseButton className="text-green-300 default-icon" onClick={handleClick} />
  return <GiPlayButton className="default-icon" onClick={handleClick} />
}
