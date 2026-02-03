import { CheckCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type UploadStep =
  | 'idle'
  | 'uploading-audio'
  | 'uploading-image'
  | 'creating-record'
  | 'success'

interface UploadProgressProps {
  step: UploadStep
  title: string
}

export function getUploadStepText(step: UploadStep): string {
  switch (step) {
    case 'uploading-audio':
      return 'Uploading audio file...'
    case 'uploading-image':
      return 'Uploading artwork...'
    case 'creating-record':
      return 'Creating audio record...'
    case 'success':
      return 'Upload completed successfully!'
    default:
      return 'Processing upload...'
  }
}

function getProgressWidth(step: UploadStep): string {
  switch (step) {
    case 'success':
      return '100%'
    case 'creating-record':
      return '80%'
    case 'uploading-image':
      return '60%'
    case 'uploading-audio':
      return '30%'
    default:
      return '10%'
  }
}

export function UploadProgress({ step, title }: UploadProgressProps) {
  const isSuccess = step === 'success'
  const stepText = getUploadStepText(step)

  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardHeader>
        <CardTitle
          className={`flex items-center ${isSuccess ? 'text-green-400' : 'text-gb-pastel-green-1'}`}>
          {isSuccess ? (
            <>
              <CheckCircle className='w-5 h-5 mr-2' />
              Upload Complete!
            </>
          ) : (
            <>
              <Loader2 className='w-5 h-5 mr-2 animate-spin' />
              {stepText}
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          <div className='w-full h-2 rounded-sm bg-gb-bg'>
            <div
              className={`h-2 rounded-sm transition-all duration-500 ${
                isSuccess ? 'bg-green-400' : 'bg-gb-highlight animate-pulse'
              }`}
              style={{ width: getProgressWidth(step) }}
            />
          </div>
          <p className='text-sm text-gb-default-text'>
            {isSuccess
              ? `"${title}" has been uploaded successfully! Redirecting...`
              : stepText}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
