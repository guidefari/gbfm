import { useMemo, useRef, useState } from 'react'

export function useAudioPreview(src: string) {
  const [playPreview, setPlayPreview] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)

  const handlers = useMemo(
    () => ({
      on: () => {
        setPlayPreview(true)
        audioRef.current.play()
      },
      off: () => {
        setPlayPreview(false)
        audioRef.current.pause()
      },
      toggle: () => {
        setPlayPreview(!playPreview)
      },
    }),
    []
  )

  //   function handleAudioPreview() {
  //     if (previewUrl && audioRef.current) {
  //       if (!playPreview) {
  //         setPlayPreview(true)
  //         audioRef.current.play()
  //       } else {
  //         setPlayPreview(false)
  //         audioRef.current.pause()
  //       }
  //     }
  //   }

  const AudioPlayer = () => <audio src={src || ''} ref={audioRef}></audio>

  return [playPreview, handlers, AudioPlayer]
}
