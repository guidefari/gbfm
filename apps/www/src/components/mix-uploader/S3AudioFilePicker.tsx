import { useQuery } from '@tanstack/react-query'
import { Check, Loader2, Music, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { fetcher, VPS_BASE_URL } from '@/lib/http'

interface S3Object {
  key: string
  lastModified: string
  size: number
}

interface BucketConfig {
  stage: string
  routerUrl: string
  buckets: {
    userContent: string
    mixes: string
  }
  availableBuckets: string[]
}

interface S3AudioFilePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (url: string, filename: string) => void
}

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'aiff',
  'aif',
  'flac',
  'ogg',
  'm4a',
  'opus',
  'wma'
])

function isAudioFile(key: string) {
  const ext = key.split('.').pop()?.toLowerCase()
  return ext ? AUDIO_EXTENSIONS.has(ext) : false
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function getPublicUrl(
  config: BucketConfig,
  bucketName: string,
  key: string
): string | null {
  if (bucketName === config.buckets.userContent) {
    return `${config.routerUrl}/user-content/${key}`
  }
  if (bucketName === config.buckets.mixes) {
    return `${config.routerUrl}/mixes/${key}`
  }
  return null
}

export function S3AudioFilePicker({
  open,
  onOpenChange,
  onSelect
}: S3AudioFilePickerProps) {
  const [selectedBucket, setSelectedBucket] = useState<string>('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const { data: configData } = useQuery<BucketConfig>({
    queryKey: ['file-manager', 'config'],
    queryFn: () => fetcher<BucketConfig>(`${VPS_BASE_URL}/file-manager/config`),
    staleTime: Infinity,
    enabled: open
  })

  // Auto-select first bucket once config loads
  const effectiveBucket =
    selectedBucket ||
    configData?.buckets.userContent ||
    configData?.availableBuckets[0] ||
    ''

  const {
    data: listData,
    isLoading: isListLoading,
    refetch
  } = useQuery<{ objects: S3Object[] }>({
    queryKey: ['file-manager', 'list', effectiveBucket],
    queryFn: () =>
      fetcher<{ objects: S3Object[] }>(
        `${VPS_BASE_URL}/file-manager/list?bucketName=${encodeURIComponent(effectiveBucket)}`
      ),
    enabled: Boolean(effectiveBucket) && open,
    staleTime: 30_000
  })

  const audioFiles =
    listData?.objects.filter((obj) => isAudioFile(obj.key)) ?? []

  const handleConfirm = () => {
    if (!selectedKey || !configData) return
    const url = getPublicUrl(configData, effectiveBucket, selectedKey)
    if (!url) return
    const filename = selectedKey.split('/').pop() ?? selectedKey
    onSelect(url, filename)
    onOpenChange(false)
    setSelectedKey(null)
  }

  const bucketOptions = configData
    ? Array.from(
        new Set([
          configData.buckets.userContent,
          configData.buckets.mixes,
          ...configData.availableBuckets
        ])
      ).filter(Boolean)
    : []

  const getBucketLabel = (bucket: string) => {
    if (!configData) return bucket
    if (bucket === configData.buckets.userContent) return `uploads · ${bucket}`
    if (bucket === configData.buckets.mixes) return `mixes · ${bucket}`
    return bucket
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl bg-gb-darker-bg border-gb-pastel-green-2/20 overflow-hidden'>
        <DialogHeader>
          <DialogTitle className='text-gb-pastel-green-1'>
            Pick audio file from S3
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4 min-w-0 w-full'>
          <div className='flex items-center gap-2'>
            <Select
              value={effectiveBucket}
              onValueChange={(v) => {
                setSelectedBucket(v)
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
            <Button
              variant='outline'
              size='sm'
              className='h-9'
              onClick={() => refetch()}>
              <RefreshCw className='h-3.5 w-3.5' />
            </Button>
          </div>

          <div className='rounded-sm border border-gb-pastel-green-2/20 overflow-hidden w-full max-w-full'>
            {isListLoading ? (
              <div className='flex items-center justify-center py-12'>
                <Loader2 className='h-6 w-6 animate-spin text-gb-highlight' />
              </div>
            ) : audioFiles.length === 0 ? (
              <div className='py-12 text-center text-sm text-muted-foreground'>
                {effectiveBucket
                  ? 'No audio files found in this bucket'
                  : 'Select a bucket to browse files'}
              </div>
            ) : (
              <div className='max-h-80 overflow-y-auto overflow-x-hidden'>
                {audioFiles.map((obj) => {
                  const isSelected = selectedKey === obj.key
                  return (
                    <button
                      key={obj.key}
                      type='button'
                      onClick={() => setSelectedKey(obj.key)}
                      className={`w-full flex items-center gap-3 pl-4 pr-3 py-2.5 text-left hover:bg-gb-pastel-green-2/10 transition-colors border-b border-gb-pastel-green-2/10 last:border-b-0 ${
                        isSelected ? 'bg-gb-pastel-green-2/15' : ''
                      }`}>
                      <div
                        className={`flex-none w-7 h-7 rounded-sm flex items-center justify-center ${
                          isSelected
                            ? 'bg-gb-highlight text-gb-darker-bg'
                            : 'bg-gb-pastel-green-2/20 text-gb-highlight'
                        }`}>
                        {isSelected ? (
                          <Check className='h-3.5 w-3.5' />
                        ) : (
                          <Music className='h-3.5 w-3.5' />
                        )}
                      </div>
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

          {selectedKey && configData && (
            <div className='rounded-sm border border-gb-pastel-green-2/20 p-3'>
              {/* biome-ignore lint/a11y/useMediaCaption: internal preview player, no captions needed */}
              <audio
                key={selectedKey}
                controls
                className='w-full h-8'
                src={
                  getPublicUrl(configData, effectiveBucket, selectedKey) ??
                  undefined
                }
              />
            </div>
          )}

          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size='sm'
              disabled={
                !selectedKey ||
                !configData ||
                !getPublicUrl(configData, effectiveBucket, selectedKey ?? '')
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
