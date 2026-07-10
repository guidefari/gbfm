'use client'
import { Pause, Play } from 'lucide-react'
import { useAudioPlayerActions, useAudioPlayerPlaybackState } from '@/store/audioPlayer'
import { DEFAULT_IMAGE_URL } from '../lib/constants'

type PlayPauseButtonProps = {
  url: string
  thumbnailUrl?: string
  title: string
  trackId?: string
}

export const PlayPauseButton = ({ url, thumbnailUrl, title, trackId }: PlayPauseButtonProps) => {
  const { audioSrc, isPlaying } = useAudioPlayerPlaybackState()
  const { loadTrack } = useAudioPlayerActions()

  const handleClick = () => loadTrack(url, thumbnailUrl || DEFAULT_IMAGE_URL, title, trackId)

  if (url !== audioSrc) return <Play className='default-icon' onClick={handleClick} />
  if (!isPlaying && url === audioSrc)
    return <Play className='default-icon ' onClick={handleClick} />
  if (isPlaying && url === audioSrc)
    return <Pause className='py-[2px] text-green-300 default-icon' onClick={handleClick} />
  return <Play className='default-icon ' onClick={handleClick} />
}
