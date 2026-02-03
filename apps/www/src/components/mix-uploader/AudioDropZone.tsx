import { Upload } from 'lucide-react'

interface AudioDropZoneProps {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function AudioDropZone({ onFileSelect }: AudioDropZoneProps) {
  return (
    <div className='relative p-12 text-center transition-colors border-2 border-dashed cursor-pointer group rounded-sm bg-gb-darker-bg border-gb-pastel-green-2/30 hover:border-gb-highlight/50'>
      <input
        type='file'
        accept='audio/*'
        onChange={onFileSelect}
        className='absolute inset-0 opacity-0 cursor-pointer'
      />
      <div className='flex items-center justify-center w-16 h-16 mx-auto mb-4 transition-transform rounded-sm bg-gb-pastel-green-2/20 group-hover:scale-110'>
        <Upload className='w-8 h-8 text-gb-highlight' />
      </div>
      <h2 className='mb-2 text-xl font-semibold text-gb-pastel-green-1'>
        Select your mix file
      </h2>
      <p className='text-muted-foreground'>
        MP3, WAV, or AIFF supported. Title will be inferred automatically.
      </p>
    </div>
  )
}
