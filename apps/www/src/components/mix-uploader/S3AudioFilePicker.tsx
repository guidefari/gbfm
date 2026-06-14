import {
  type BucketConfig,
  S3MediaFilePicker as S3MediaFilePickerUI,
  type S3Object
} from '@gbfm/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { apiUrl, fetcher } from '@/lib/http'

interface S3AudioFilePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (url: string, filename: string) => void
}

interface S3MediaFilePickerProps extends S3AudioFilePickerProps {
  mediaType: 'audio' | 'image'
}

export function S3MediaFilePicker({
  open,
  onOpenChange,
  onSelect,
  mediaType
}: S3MediaFilePickerProps) {
  const [selectedBucket, setSelectedBucket] = useState<string>('')

  const { data: configData } = useQuery<BucketConfig>({
    queryKey: ['file-manager', 'config'],
    queryFn: () => fetcher<BucketConfig>(apiUrl('/file-manager/config')),
    staleTime: Infinity,
    enabled: open
  })

  const effectiveBucket =
    selectedBucket || configData?.buckets.userContent || configData?.availableBuckets[0] || ''

  const {
    data: listData,
    isLoading: isListLoading,
    refetch
  } = useQuery<{ objects: S3Object[] }>({
    queryKey: ['file-manager', 'list', effectiveBucket],
    queryFn: () =>
      fetcher<{ objects: S3Object[] }>(
        apiUrl(`/file-manager/list?bucketName=${encodeURIComponent(effectiveBucket)}`)
      ),
    enabled: Boolean(effectiveBucket) && open,
    staleTime: 30_000
  })

  return (
    <S3MediaFilePickerUI
      open={open}
      onOpenChange={onOpenChange}
      onSelect={onSelect}
      mediaType={mediaType}
      config={configData}
      objects={listData?.objects ?? []}
      isLoading={isListLoading}
      selectedBucket={effectiveBucket}
      onBucketChange={setSelectedBucket}
      onRefresh={() => refetch()}
    />
  )
}

export function S3AudioFilePicker(props: S3AudioFilePickerProps) {
  return <S3MediaFilePicker {...props} mediaType='audio' />
}
