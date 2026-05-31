import { Loader2 } from 'lucide-react'

export type MixUploadStep =
  | 'idle'
  | 'uploading-audio'
  | 'uploading-image'
  | 'creating-record'
  | 'success'

interface MixUploadProgressProps {
  step: MixUploadStep
}

export function MixUploadProgress({ step }: MixUploadProgressProps) {
  if (step === 'idle' || step === 'success') return null

  const progress =
    step === 'creating-record'
      ? 80
      : step === 'uploading-image'
        ? 60
        : step === 'uploading-audio'
          ? 30
          : 10

  return (
    <div className='w-full p-4 border rounded-sm md:w-64 bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <div className='flex justify-between mb-2 text-sm'>
        <span className='font-medium text-gb-pastel-green-1'>Uploading Mix...</span>
        <Loader2 className='w-4 h-4 animate-spin text-gb-highlight' />
      </div>
      <div className='w-full h-2 rounded-sm bg-gb-bg'>
        <div
          className='h-2 transition-all duration-300 rounded-sm bg-gb-highlight'
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
