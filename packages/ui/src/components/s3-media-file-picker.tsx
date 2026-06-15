import { Check, ImageIcon, Loader2, Music, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from './button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

export interface S3Object {
  key: string
  lastModified: string
  size: number
}

export interface BucketConfig {
  stage: string
  bucketRouterUrl: string
  buckets: {
    userContent: string
    mixes: string
  }
  availableBuckets: string[]
}

export interface S3MediaFilePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (url: string, filename: string) => void
  mediaType: 'audio' | 'image'
  config?: BucketConfig
  objects: S3Object[]
  isLoading: boolean
  selectedBucket: string
  onBucketChange: (bucket: string) => void
  onRefresh: () => void
}

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'aiff', 'aif', 'flac', 'ogg', 'm4a', 'opus', 'wma'])

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'])

function isAudioFile(key: string) {
  const ext = key.split('.').pop()?.toLowerCase()
  return ext ? AUDIO_EXTENSIONS.has(ext) : false
}

function isImageFile(key: string) {
  const ext = key.split('.').pop()?.toLowerCase()
  return ext ? IMAGE_EXTENSIONS.has(ext) : false
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

export function getS3PublicUrl(
  config: BucketConfig,
  bucketName: string,
  key: string
): string | null {
  if (bucketName === config.buckets.userContent) {
    return `${config.bucketRouterUrl}/user-content/${key}`
  }
  if (bucketName === config.buckets.mixes) {
    return `${config.bucketRouterUrl}/mixes/${key}`
  }
  return null
}

export function S3MediaFilePicker({
  open,
  onOpenChange,
  onSelect,
  mediaType,
  config,
  objects,
  isLoading,
  selectedBucket,
  onBucketChange,
  onRefresh
}: S3MediaFilePickerProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const mediaFiles = objects.filter((obj) =>
    mediaType === 'audio' ? isAudioFile(obj.key) : isImageFile(obj.key)
  )

  const title = mediaType === 'audio' ? 'Pick audio file from S3' : 'Pick image from S3'
  const emptyMessage = selectedBucket
    ? `No ${mediaType} files found in this bucket`
    : 'Select a bucket to browse files'

  const handleConfirm = () => {
    if (!selectedKey || !config) return
    const url = getS3PublicUrl(config, selectedBucket, selectedKey)
    if (!url) return
    const filename = selectedKey.split('/').pop() ?? selectedKey
    onSelect(url, filename)
    onOpenChange(false)
    setSelectedKey(null)
  }

  const bucketOptions = config
    ? Array.from(
        new Set([config.buckets.userContent, config.buckets.mixes, ...config.availableBuckets])
      ).filter(Boolean)
    : []

  const getBucketLabel = (bucket: string) => {
    if (!config) return bucket
    if (bucket === config.buckets.userContent) return `uploads · ${bucket}`
    if (bucket === config.buckets.mixes) return `mixes · ${bucket}`
    return bucket
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl bg-gb-darker-bg border-gb-pastel-green-2/20 overflow-hidden'>
        <DialogHeader>
          <DialogTitle className='text-gb-pastel-green-1'>{title}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4 min-w-0 w-full'>
          <div className='flex items-center gap-2'>
            <Select
              value={selectedBucket}
              onValueChange={(v) => {
                onBucketChange(v)
                setSelectedKey(null)
              }}>
              <SelectTrigger className='flex-1 h-9 text-sm'>
                <SelectValue placeholder='Select bucket' />
              </SelectTrigger>
              <SelectContent>
                {bucketOptions.map((bucket) => (
                  <SelectItem key={bucket} value={bucket} className='text-xs'>
                    {getBucketLabel(bucket)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant='outline' size='sm' className='h-9' onClick={onRefresh}>
              <RefreshCw className='h-3.5 w-3.5' />
            </Button>
          </div>

          <div className='rounded-sm border border-gb-pastel-green-2/20 overflow-hidden w-full max-w-full'>
            {isLoading ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='h-6 w-6 animate-spin text-gb-highlight' />
              </div>
            ) : mediaFiles.length === 0 ? (
              <div className='py-12 text-center text-sm text-muted-foreground'>{emptyMessage}</div>
            ) : (
              <div className='max-h-80 overflow-y-auto overflow-x-hidden'>
                {mediaFiles.map((obj) => {
                  const isSelected = selectedKey === obj.key
                  const publicUrl = config ? getS3PublicUrl(config, selectedBucket, obj.key) : null
                  return (
                    <button
                      key={obj.key}
                      type='button'
                      onClick={() => setSelectedKey(obj.key)}
                      disabled={!publicUrl}
                      className={`w-full flex items-center gap-3 pl-4 pr-3 py-2.5 text-left hover:bg-gb-pastel-green-2/10 transition-colors border-b border-gb-pastel-green-2/10 last:border-b-0 ${
                        isSelected ? 'bg-gb-pastel-green-2/15' : ''
                      } ${publicUrl ? '' : 'cursor-not-allowed opacity-50'}`}>
                      {mediaType === 'image' && publicUrl ? (
                        <div className='relative flex-none h-12 w-12 overflow-hidden rounded-sm border border-gb-pastel-green-2/20 bg-gb-pastel-green-2/10'>
                          <img
                            src={publicUrl}
                            alt={obj.key.split('/').pop() ?? obj.key}
                            loading='lazy'
                            className='h-full w-full object-cover'
                          />
                          {isSelected && (
                            <div className='absolute inset-0 flex items-center justify-center bg-gb-highlight/80 text-gb-darker-bg'>
                              <Check className='h-4 w-4' />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className={`flex-none w-7 h-7 rounded-sm flex items-center justify-center ${
                            isSelected
                              ? 'bg-gb-highlight text-gb-darker-bg'
                              : 'bg-gb-pastel-green-2/20 text-gb-highlight'
                          }`}>
                          {isSelected ? (
                            <Check className='h-3.5 w-3.5' />
                          ) : mediaType === 'image' ? (
                            <ImageIcon className='h-3.5 w-3.5' />
                          ) : (
                            <Music className='h-3.5 w-3.5' />
                          )}
                        </div>
                      )}
                      <p className='flex-1 min-w-0 text-sm font-mono text-gb-default-text truncate'>
                        {obj.key.split('/').pop() ?? obj.key}
                      </p>
                      <span className='flex-none text-xs tabular-nums text-muted-foreground ml-3'>
                        {formatBytes(obj.size)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {selectedKey && config && mediaType === 'audio' && (
            <div className='rounded-sm border border-gb-pastel-green-2/20 p-3'>
              {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                key={selectedKey}
                controls
                className='w-full h-8'
                src={getS3PublicUrl(config, selectedBucket, selectedKey) ?? undefined}
              />
            </div>
          )}

          {selectedKey && config && mediaType === 'image' && (
            <div className='rounded-sm border border-gb-pastel-green-2/20 p-3'>
              <img
                src={getS3PublicUrl(config, selectedBucket, selectedKey) ?? undefined}
                alt={selectedKey.split('/').pop() ?? selectedKey}
                className='h-40 w-full rounded-sm object-cover'
              />
            </div>
          )}

          <div className='flex justify-end gap-2'>
            <Button variant='outline' size='sm' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size='sm'
              disabled={
                !selectedKey ||
                !config ||
                !getS3PublicUrl(config, selectedBucket, selectedKey ?? '')
              }
              onClick={handleConfirm}
              className='bg-gb-highlight text-gb-darker-bg hover:bg-gb-highlight/90'>
              Use this file
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
