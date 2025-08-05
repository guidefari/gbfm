'use client'
import { GiPauseButton, GiPlayButton } from 'react-icons/gi'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'
import { DEFAULT_IMAGE_URL } from '../lib/constants'

type PlayPauseButtonProps = {
  url: string
  thumbnailUrl?: string
  title: string
}

export const PlayPauseButton = ({
  url,
  thumbnailUrl,
  title
}: PlayPauseButtonProps) => {
  const { audioSrc, isPlaying } = useAudioPlayerState()
  const { loadTrack } = useAudioPlayerActions()

  const handleClick = () =>
    loadTrack(url, thumbnailUrl || DEFAULT_IMAGE_URL, title)

  if (url !== audioSrc)
    return <GiPlayButton className='default-icon' onClick={handleClick} />
  if (!isPlaying && url === audioSrc)
    return <GiPlayButton className='default-icon ' onClick={handleClick} />
  if (isPlaying && url === audioSrc)
    return (
      <GiPauseButton
        className='py-[2px] text-green-300 default-icon'
        onClick={handleClick}
      />
    )
  return <GiPlayButton className='default-icon ' onClick={handleClick} />
}
