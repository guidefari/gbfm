import { useCallback, useState } from 'react'

interface UseFileUploadOptions {
  onTitleInfer?: (title: string) => void
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, inferTitle = false) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) {
        setFile(selectedFile)
        const url = URL.createObjectURL(selectedFile)
        setPreview(url)

        if (inferTitle && options.onTitleInfer) {
          const fileName = selectedFile.name.replace(/\.[^/.]+$/, '')
          const cleanTitle = fileName
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase())
          options.onTitleInfer(cleanTitle)
        }
      }
    },
    [options]
  )

  const removeFile = useCallback(
    (existingUrl?: string) => {
      setFile(null)
      if (preview && !existingUrl) {
        URL.revokeObjectURL(preview)
      }
      setPreview(null)
    },
    [preview]
  )

  const setExistingPreview = useCallback((url: string) => {
    setPreview(url)
  }, [])

  return {
    file,
    preview,
    handleFileChange,
    removeFile,
    setExistingPreview
  }
}
