import { Track } from '@/lib/types'
import { useAudioPlayerContext } from 'contexts/AudioPlayer'
import { useEffect, useState, useRef, useCallback } from 'react'
import { BsMusicNoteBeamed } from 'react-icons/bs'
// icons
import {
  IoPlayBackSharp,
  IoPlayForwardSharp,
  IoPlaySkipBackSharp,
  IoPlaySkipForwardSharp,
  IoPlaySharp,
  IoPauseSharp,
} from 'react-icons/io5'

import { IoMdVolumeHigh, IoMdVolumeOff, IoMdVolumeLow } from 'react-icons/io'

const AudioPlayer = ({ albumImageUrl, artists, title, trackUrl }: Track) => {
  const [audioRef, { handleAlbumArtClick, play }, isPlaying] = useAudioPlayerContext()
  const [trackDetails, setTrackDetails] = useState<Track>(null)
  const [timeProgress, setTimeProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(60)
  const [muteVolume, setMuteVolume] = useState(false)
  const playAnimationRef = useRef()
  // useEffect(() => {
  //   handlers.handleAlbumArtClick(trackDetails.trackUrl)
  // }, [trackDetails])

  useEffect(() => {
    // setTrackDetails({albumImageUrl, artists, title, trackUrl})
  }, [])

  return (
    <div>
      <section className="audio-info">
        <div className="audio-image">
          {albumImageUrl ? (
            <img src={albumImageUrl} alt="audio avatar" />
          ) : (
            <div className="icon-wrapper">
              <span className="audio-icon">
                <BsMusicNoteBeamed />
              </span>
            </div>
          )}
        </div>
        <div className="text">
          <p className="title">{title}</p>
          <p>{artists}</p>
        </div>
      </section>
      <section />
    </div>
  )
}
export default AudioPlayer
