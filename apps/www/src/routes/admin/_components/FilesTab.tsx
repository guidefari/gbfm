import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, ArrowRight, Copy, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { fetcher, VPS_BASE_URL } from '@/lib/http'

const STORAGE_KEY_BUCKET_A = 'filemanager:bucketA'
const STORAGE_KEY_BUCKET_B = 'filemanager:bucketB'
const STORAGE_KEY_RECENT_BUCKETS = 'filemanager:recentBuckets'
const CUSTOM_BUCKET_VALUE = '__custom__'

interface S3Object {
  key: string
  lastModified: string
  size: number
}

interface BucketConfig {
  stage: string
  buckets: {
    userContent: string
    mixes: string
  }
  availableBuckets: string[]
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

export function FilesTab() {
  const queryClient = useQueryClient()

  const { data: configData } = useQuery<BucketConfig>({
    queryKey: ['file-manager', 'config'],
    queryFn: () => fetcher<BucketConfig>(`${VPS_BASE_URL}/file-manager/config`),
    staleTime: Infinity
  })

  const [bucketA, setBucketA] = useState(
    () => localStorage.getItem(STORAGE_KEY_BUCKET_A) ?? ''
  )
  const [bucketB, setBucketB] = useState(
    () => localStorage.getItem(STORAGE_KEY_BUCKET_B) ?? ''
  )
  const [isCustomBucketA, setIsCustomBucketA] = useState(false)
  const [isCustomBucketB, setIsCustomBucketB] = useState(false)
  const [recentBuckets, setRecentBuckets] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RECENT_BUCKETS)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (value): value is string => typeof value === 'string'
      )
    } catch {
      return []
    }
  })

  const rememberBucket = useCallback((bucketName: string) => {
    if (!bucketName.trim()) return
    setRecentBuckets((prev) => {
      const next = [
        bucketName,
        ...prev.filter((item) => item !== bucketName)
      ].slice(0, 8)
      localStorage.setItem(STORAGE_KEY_RECENT_BUCKETS, JSON.stringify(next))
      return next
    })
  }, [])

  const persistBucketA = useCallback(
    (v: string) => {
      setBucketA(v)
      localStorage.setItem(STORAGE_KEY_BUCKET_A, v)
      rememberBucket(v)
    },
    [rememberBucket]
  )

  const persistBucketB = useCallback(
    (v: string) => {
      setBucketB(v)
      localStorage.setItem(STORAGE_KEY_BUCKET_B, v)
      rememberBucket(v)
    },
    [rememberBucket]
  )

  // Default to known stage buckets, so most users never need manual entry.
  useEffect(() => {
    if (!configData) return

    if (!bucketA) {
      persistBucketA(configData.buckets.mixes)
    }

    if (!bucketB) {
      persistBucketB(configData.buckets.userContent)
    }
  }, [bucketA, bucketB, configData, persistBucketA, persistBucketB])

  // Keep custom-mode toggles in sync with persisted values.
  useEffect(() => {
    if (!configData) return

    const knownBucketValues = new Set([
      ...Object.values(configData.buckets),
      ...configData.availableBuckets
    ])
    setIsCustomBucketA((prev) =>
      prev
        ? !knownBucketValues.has(bucketA)
        : Boolean(bucketA) && !knownBucketValues.has(bucketA)
    )
    setIsCustomBucketB((prev) =>
      prev
        ? !knownBucketValues.has(bucketB)
        : Boolean(bucketB) && !knownBucketValues.has(bucketB)
    )
  }, [bucketA, bucketB, configData])

  const { data: listA } = useQuery<{ objects: S3Object[] }>({
    queryKey: ['file-manager', 'list', bucketA],
    queryFn: () =>
      fetcher<{ objects: S3Object[] }>(
        `${VPS_BASE_URL}/file-manager/list?bucketName=${encodeURIComponent(bucketA)}`
      ),
    enabled: Boolean(bucketA),
    staleTime: 30_000
  })

  const { data: listB } = useQuery<{ objects: S3Object[] }>({
    queryKey: ['file-manager', 'list', bucketB],
    queryFn: () =>
      fetcher<{ objects: S3Object[] }>(
        `${VPS_BASE_URL}/file-manager/list?bucketName=${encodeURIComponent(bucketB)}`
      ),
    enabled: Boolean(bucketB),
    staleTime: 30_000
  })

  const keysInA = new Set(listA?.objects.map((o) => o.key) ?? [])
  const keysInB = new Set(listB?.objects.map((o) => o.key) ?? [])

  const copyMutation = useMutation<
    { key: string },
    Error,
    { key: string; sourceBucket: string; destinationBucket: string }
  >({
    mutationFn: (body) =>
      fetcher(`${VPS_BASE_URL}/file-manager/copy`, {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['file-manager', 'list', variables.destinationBucket]
      })
      toast({
        title: 'Copied',
        description: `${variables.key} → ${variables.destinationBucket}`
      })
    },
    onError: (err) => {
      toast({
        title: 'Copy failed',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  // All unique keys across both buckets
  const allKeys = Array.from(new Set([...keysInA, ...keysInB])).sort()

  const getStatus = (key: string) => {
    const inA = keysInA.has(key)
    const inB = keysInB.has(key)
    if (inA && inB) return 'both'
    if (inA) return 'a-only'
    return 'b-only'
  }

  const stageBuckets = configData
    ? Object.entries(configData.buckets).filter(
        ([, bucket], index, arr) =>
          arr.findIndex(([, value]) => value === bucket) === index
      )
    : []
  const stageBucketValues = new Set(stageBuckets.map(([, bucket]) => bucket))
  const availableBuckets = configData
    ? Array.from(new Set(configData.availableBuckets)).filter(Boolean)
    : []
  const discoveredBuckets = availableBuckets.filter(
    (bucket) => !stageBucketValues.has(bucket)
  )
  const selectableCustomBuckets = recentBuckets.filter(
    (bucket) =>
      !stageBucketValues.has(bucket) && !availableBuckets.includes(bucket)
  )
  const selectValueA = isCustomBucketA
    ? CUSTOM_BUCKET_VALUE
    : bucketA || undefined
  const selectValueB = isCustomBucketB
    ? CUSTOM_BUCKET_VALUE
    : bucketB || undefined
  const isSameBucketSelected = Boolean(
    bucketA && bucketB && bucketA === bucketB
  )

  return (
    <div className='space-y-6'>
      {configData && (
        <div className='text-xs text-muted-foreground'>
          Stage: <span className='font-semibold'>{configData.stage}</span>
        </div>
      )}

      <div className='flex items-center justify-between gap-2'>
        <p className='text-xs text-muted-foreground'>
          Pick from known buckets first. Use custom mode only for external or
          one-off buckets.
        </p>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-8'
          disabled={!bucketA || !bucketB}
          onClick={() => {
            const nextA = bucketB
            const nextB = bucketA
            const nextCustomA = isCustomBucketB
            const nextCustomB = isCustomBucketA
            persistBucketA(nextA)
            persistBucketB(nextB)
            setIsCustomBucketA(nextCustomA)
            setIsCustomBucketB(nextCustomB)
          }}>
          <ArrowLeftRight className='h-3.5 w-3.5 mr-1.5' />
          Swap A/B
        </Button>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-1.5'>
          <Label className='text-xs text-muted-foreground'>Bucket A</Label>
          <Select
            value={selectValueA}
            onValueChange={(value) => {
              if (value === CUSTOM_BUCKET_VALUE) {
                setIsCustomBucketA(true)
                persistBucketA('')
                return
              }
              setIsCustomBucketA(false)
              persistBucketA(value)
            }}>
            <SelectTrigger className='h-8 text-xs'>
              <SelectValue placeholder='Select source bucket' />
            </SelectTrigger>
            <SelectContent>
              {stageBuckets.map(([name, bucket]) => (
                <SelectItem key={name} value={bucket} className='text-xs'>
                  {name} · {bucket}
                </SelectItem>
              ))}
              {selectableCustomBuckets.map((bucket) => (
                <SelectItem
                  key={`saved-a-${bucket}`}
                  value={bucket}
                  className='text-xs font-mono'>
                  saved · {bucket}
                </SelectItem>
              ))}
              {discoveredBuckets.map((bucket) => (
                <SelectItem
                  key={`available-a-${bucket}`}
                  value={bucket}
                  className='text-xs font-mono'>
                  available · {bucket}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_BUCKET_VALUE} className='text-xs'>
                Custom bucket name...
              </SelectItem>
            </SelectContent>
          </Select>
          {isCustomBucketA && (
            <Input
              value={bucketA}
              onChange={(e) => persistBucketA(e.target.value)}
              placeholder='Paste bucket A name'
              className='h-8 text-xs font-mono'
            />
          )}
        </div>

        <div className='space-y-1.5'>
          <Label className='text-xs text-muted-foreground'>Bucket B</Label>
          <Select
            value={selectValueB}
            onValueChange={(value) => {
              if (value === CUSTOM_BUCKET_VALUE) {
                setIsCustomBucketB(true)
                persistBucketB('')
                return
              }
              setIsCustomBucketB(false)
              persistBucketB(value)
            }}>
            <SelectTrigger className='h-8 text-xs'>
              <SelectValue placeholder='Select destination bucket' />
            </SelectTrigger>
            <SelectContent>
              {stageBuckets.map(([name, bucket]) => (
                <SelectItem key={name} value={bucket} className='text-xs'>
                  {name} · {bucket}
                </SelectItem>
              ))}
              {selectableCustomBuckets.map((bucket) => (
                <SelectItem
                  key={`saved-b-${bucket}`}
                  value={bucket}
                  className='text-xs font-mono'>
                  saved · {bucket}
                </SelectItem>
              ))}
              {discoveredBuckets.map((bucket) => (
                <SelectItem
                  key={`available-b-${bucket}`}
                  value={bucket}
                  className='text-xs font-mono'>
                  available · {bucket}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_BUCKET_VALUE} className='text-xs'>
                Custom bucket name...
              </SelectItem>
            </SelectContent>
          </Select>
          {isCustomBucketB && (
            <Input
              value={bucketB}
              onChange={(e) => persistBucketB(e.target.value)}
              placeholder='Paste bucket B name'
              className='h-8 text-xs font-mono'
            />
          )}
        </div>
      </div>

      {isSameBucketSelected && (
        <div className='rounded-sm border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-300'>
          Bucket A and Bucket B are the same. Choose two different buckets to
          compare or copy files.
        </div>
      )}

      {/* Diff table */}
      {allKeys.length > 0 && (
        <div className='overflow-x-auto rounded-sm border'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='px-4 py-3 text-left font-medium'>Key</th>
                <th className='px-4 py-3 text-left font-medium'>Size</th>
                <th className='px-4 py-3 text-left font-medium'>Status</th>
                <th className='px-4 py-3 text-left font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allKeys.map((key) => {
                const status = getStatus(key)
                const objA = listA?.objects.find((o) => o.key === key)
                const objB = listB?.objects.find((o) => o.key === key)
                const size = objA?.size ?? objB?.size ?? 0
                const isCopying =
                  copyMutation.isPending && copyMutation.variables?.key === key

                return (
                  <tr key={key} className='border-b hover:bg-muted/50'>
                    <td className='px-4 py-3 font-mono text-xs max-w-xs truncate'>
                      {key}
                    </td>
                    <td className='px-4 py-3 text-muted-foreground text-xs whitespace-nowrap'>
                      {formatBytes(size)}
                    </td>
                    <td className='px-4 py-3'>
                      {status === 'both' && (
                        <Badge variant='outline' className='text-xs'>
                          In both
                        </Badge>
                      )}
                      {status === 'a-only' && (
                        <Badge
                          variant='secondary'
                          className='text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'>
                          A only
                        </Badge>
                      )}
                      {status === 'b-only' && (
                        <Badge
                          variant='secondary'
                          className='text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'>
                          B only
                        </Badge>
                      )}
                    </td>
                    <td className='px-4 py-3'>
                      <div className='flex gap-2'>
                        {status === 'a-only' && bucketB && (
                          <Button
                            variant='outline'
                            size='sm'
                            disabled={isCopying || isSameBucketSelected}
                            onClick={() =>
                              copyMutation.mutate({
                                key,
                                sourceBucket: bucketA,
                                destinationBucket: bucketB
                              })
                            }>
                            {isCopying ? (
                              <Loader2 className='h-3.5 w-3.5 animate-spin' />
                            ) : (
                              <>
                                <ArrowRight className='h-3.5 w-3.5 mr-1' />
                                Copy to B
                              </>
                            )}
                          </Button>
                        )}
                        {status === 'b-only' && bucketA && (
                          <Button
                            variant='outline'
                            size='sm'
                            disabled={isCopying || isSameBucketSelected}
                            onClick={() =>
                              copyMutation.mutate({
                                key,
                                sourceBucket: bucketB,
                                destinationBucket: bucketA
                              })
                            }>
                            {isCopying ? (
                              <Loader2 className='h-3.5 w-3.5 animate-spin' />
                            ) : (
                              <>
                                <ArrowRight className='h-3.5 w-3.5 mr-1 rotate-180' />
                                Copy to A
                              </>
                            )}
                          </Button>
                        )}
                        {status === 'both' && (
                          <div className='flex gap-1'>
                            <Button
                              variant='ghost'
                              size='sm'
                              disabled={
                                isCopying || !bucketB || isSameBucketSelected
                              }
                              title='Re-copy A → B'
                              onClick={() =>
                                copyMutation.mutate({
                                  key,
                                  sourceBucket: bucketA,
                                  destinationBucket: bucketB
                                })
                              }>
                              <Copy className='h-3.5 w-3.5 mr-1' />
                              A→B
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              disabled={
                                isCopying || !bucketA || isSameBucketSelected
                              }
                              title='Re-copy B → A'
                              onClick={() =>
                                copyMutation.mutate({
                                  key,
                                  sourceBucket: bucketB,
                                  destinationBucket: bucketA
                                })
                              }>
                              <Copy className='h-3.5 w-3.5 mr-1' />
                              B→A
                            </Button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {listA && listB && allKeys.length === 0 && (
        <div className='py-8 text-center text-muted-foreground text-sm'>
          Both buckets are empty
        </div>
      )}

      {!listA && !listB && bucketA && bucketB && (
        <div className='py-8 text-center text-muted-foreground text-sm'>
          Loading...
        </div>
      )}

      {(!bucketA || !bucketB) && (
        <div className='py-4 text-center text-muted-foreground text-sm'>
          Enter both bucket names to compare
        </div>
      )}
    </div>
  )
}
