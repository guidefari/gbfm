import { Loader2 } from 'lucide-react'

export type MixUploadStep =
  | 'idle'
  | 'uploading-audio'
  | 'paused-audio'
  | 'uploading-image'
  | 'creating-record'
  | 'success'

interface MixUploadProgressProps {
  step: MixUploadStep
  audioProgress?: {
    bytesUploaded: number
    totalBytes: number
    currentPart: number
    totalParts: number
  }
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function MixUploadProgress({ step, audioProgress }: MixUploadProgressProps) {
  if (step === 'idle' || step === 'success') return null

  const isPaused = step === 'paused-audio'
  const stepLabel = isPaused
    ? 'Paused - will resume automatically'
    : step === 'uploading-audio'
      ? 'Uploading audio'
      : step === 'uploading-image'
        ? 'Uploading artwork'
        : step === 'creating-record'
          ? 'Saving mix'
          : 'Working...'

  const percent = (() => {
    if (step === 'creating-record') return 85
    if (step === 'uploading-image') return 70
    if (step === 'uploading-audio' && audioProgress && audioProgress.totalBytes > 0) {
      return Math.min(65, Math.round((audioProgress.bytesUploaded / audioProgress.totalBytes) * 65))
    }
    if (isPaused && audioProgress && audioProgress.totalBytes > 0) {
      return Math.min(65, Math.round((audioProgress.bytesUploaded / audioProgress.totalBytes) * 65))
    }
    return 5
  })()

  return (
    <div className='w-full p-4 border rounded-sm md:w-72 bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <div className='flex justify-between items-center mb-2 text-sm'>
        <span className='font-medium text-gb-pastel-green-1'>{stepLabel}</span>
        {isPaused ? (
          <span className='text-xs text-gb-pastel-green-2/70'>paused</span>
        ) : (
          <Loader2 className='w-4 h-4 animate-spin text-gb-highlight' />
        )}
      </div>
      <div className='w-full h-2 rounded-sm bg-gb-bg'>
        <div
          className={`h-2 transition-all duration-300 rounded-sm ${isPaused ? 'bg-gb-pastel-green-2/50' : 'bg-gb-highlight'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {audioProgress && audioProgress.totalBytes > 0 && (
        <div className='flex justify-between mt-2 text-xs text-gb-default-text'>
          <span>
            {formatBytes(audioProgress.bytesUploaded)} / {formatBytes(audioProgress.totalBytes)}
          </span>
          <span>
            Part {audioProgress.currentPart}/{audioProgress.totalParts}
          </span>
        </div>
      )}
    </div>
  )
}
