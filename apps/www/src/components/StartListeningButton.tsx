import type { SelectAudio } from '@gbfm/vps/schemas'
import { useNavigate } from '@tanstack/react-router'
import { Disc3, Pause, Play } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useFeaturedMix } from '@/lib/useFeaturedMix'
import { cn } from '@/lib/utils'
import { useAudioPlayerActions, useAudioPlayerState } from '@/store/audioPlayer'

interface PlayButtonProps {
  featuredMix?: SelectAudio | null
  isLoading?: boolean
  onStart?: () => void
}

export function StartListeningButton({
  featuredMix: propFeaturedMix,
  isLoading = false,
  onStart
}: PlayButtonProps) {
  const { data: featuredMix, isPending } = useFeaturedMix()
  const { loadTrack, play, pause } = useAudioPlayerActions()
  const { audioSrc, isPlaying } = useAudioPlayerState()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const actualMix = propFeaturedMix || featuredMix
  const actualLoading = isLoading || isPending
  const hasActivePlayer = Boolean(audioSrc)

  const handleStartListening = () => {
    if (!actualMix) return

    setError(null)
    onStart?.()

    try {
      if (!actualMix.url) {
        throw new Error('No audio available for this mix')
      }

      loadTrack(
        actualMix.url,
        actualMix.thumbnailUrl || '',
        actualMix.title,
        actualMix.id
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start playback')
    }
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }

  const handleExploreMixes = () => {
    navigate({ to: '/mixes' })
  }

  if (error) {
    return (
      <button
        type='button'
        onClick={() => setError(null)}
        className='inline-flex items-center gap-2 hover:text-highlight transition-colors'
        title='Try again'>
        <span>⚠</span>
        <span>try again</span>
      </button>
    )
  }

  if (actualLoading) {
    return (
      <div className='inline-flex items-center gap-2'>
        <Disc3 className='w-4 h-4 animate-spin' />
        <span>loading...</span>
      </div>
    )
  }

  if (hasActivePlayer) {
    return (
      <>
        <button
          type='button'
          onClick={handlePlayPause}
          className='inline-flex items-center gap-2 hover:text-highlight transition-colors'
          title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? (
            <Pause className='w-4 h-4' />
          ) : (
            <Play className='w-4 h-4' />
          )}
          <span>{isPlaying ? 'pause' : 'play'}</span>
        </button>
        <motion.button
          type='button'
          onClick={handleExploreMixes}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.15, ease: 'easeOut' }}
          className='inline-flex items-center gap-2 hover:text-highlight transition-colors'
          title='Browse all mixes'>
          <Disc3 className='w-4 h-4' />
          <span>explore more mixes</span>
        </motion.button>
      </>
    )
  }

  return (
    <button
      type='button'
      onClick={handleStartListening}
      disabled={!actualMix}
      className={cn(
        'inline-flex items-center gap-2 hover:text-highlight transition-colors',
        !actualMix && 'opacity-50 cursor-not-allowed'
      )}
      title='Play featured mix'>
      <Play className='w-4 h-4' />
      <span>start listening</span>
    </button>
  )
}
