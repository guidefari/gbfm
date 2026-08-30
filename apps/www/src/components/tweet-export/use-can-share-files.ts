import { useEffect, useState } from 'react'
import { runAppEffect } from '@/runtime'
import { ImageExport } from '@/services/image-export'

/** Resolved after mount so server and first client render agree. */
export function useCanShareFiles() {
  const [canShareFiles, setCanShareFiles] = useState(false)

  useEffect(() => {
    let active = true
    void runAppEffect(ImageExport.use((service) => service.canShareFiles)).then((result) => {
      if (active) setCanShareFiles(result)
    })
    return () => {
      active = false
    }
  }, [])

  return canShareFiles
}
