import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Copy,
  Loader2,
  RefreshCw,
  ServerCrash
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { fetcher, VPS_BASE_URL } from '@/lib/http'

const STORAGE_KEY_BUCKET_A = 'filemanager:bucketA'
const STORAGE_KEY_BUCKET_B = 'filemanager:bucketB'

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
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function BucketPanel({
  label,
  bucketName,
  onBucketNameChange,
  knownBuckets
}: {
  label: string
  bucketName: string
  onBucketNameChange: (v: string) => void
  knownBuckets: BucketConfig['buckets'] | undefined
}) {
  const { data, isPending, error, refetch } = useQuery<{ objects: S3Object[] }>(
    {
      queryKey: ['file-manager', 'list', bucketName],
      queryFn: () =>
        fetcher<{ objects: S3Object[] }>(
          `${VPS_BASE_URL}/file-manager/list?bucketName=${encodeURIComponent(bucketName)}`
        ),
      enabled: Boolean(bucketName),
      staleTime: 30_000
    }
  )

  return (
    <div className='flex-1 min-w-0 space-y-3'>
      <div className='flex items-center justify-between gap-2'>
        <h3 className='text-sm font-semibold'>{label}</h3>
        <Button
          variant='ghost'
          size='icon'
          className='h-7 w-7'
          onClick={() => refetch()}
          disabled={isPending || !bucketName}>
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className='space-y-1.5'>
        <Label className='text-xs text-muted-foreground'>Bucket name</Label>
        <Input
          value={bucketName}
          onChange={(e) => onBucketNameChange(e.target.value)}
          placeholder='e.g. my-app-dev-mixes-abc123'
          className='h-8 text-xs font-mono'
        />
        {knownBuckets && (
          <div className='flex flex-wrap gap-1.5 pt-0.5'>
            <span className='text-xs text-muted-foreground'>Known:</span>
            {Object.entries(knownBuckets).map(([name, bucket]) => (
              <button
                key={name}
                type='button'
                onClick={() => onBucketNameChange(bucket)}
                className='text-xs text-primary underline-offset-2 hover:underline truncate max-w-[180px]'>
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className='rounded-sm border min-h-[200px] overflow-x-auto'>
        {!bucketName ? (
          <div className='flex items-center justify-center h-40 text-sm text-muted-foreground'>
            Enter a bucket name above
          </div>
        ) : isPending ? (
          <div className='flex items-center justify-center h-40 gap-2 text-sm text-muted-foreground'>
            <Loader2 className='h-4 w-4 animate-spin' />
            Loading objects...
          </div>
        ) : error ? (
          <div className='flex items-center justify-center h-40 gap-2 text-sm text-destructive'>
            <ServerCrash className='h-4 w-4' />
            Failed to load — check bucket name &amp; permissions
          </div>
        ) : (
          <div className='text-xs text-muted-foreground px-3 pt-2 pb-1'>
            {data?.objects.length ?? 0} objects
          </div>
        )}
      </div>
    </div>
  )
}

export function FilesTab() {
  const queryClient = useQueryClient()

  const { data: configData } = useQuery<BucketConfig>({
    queryKey: ['file-manager', 'config'],
    queryFn: () =>
      fetcher<BucketConfig>(`${VPS_BASE_URL}/file-manager/config`),
    staleTime: Infinity
  })

  const [bucketA, setBucketA] = useState(
    () => localStorage.getItem(STORAGE_KEY_BUCKET_A) ?? ''
  )
  const [bucketB, setBucketB] = useState(
    () => localStorage.getItem(STORAGE_KEY_BUCKET_B) ?? ''
  )
  const [activeBucket, setActiveBucket] = useState<'mixes' | 'userContent'>(
    'mixes'
  )

  // Pre-fill bucket A from config on first load
  useEffect(() => {
    if (configData && !bucketA) {
      const name = configData.buckets[activeBucket]
      if (name) {
        setBucketA(name)
        localStorage.setItem(STORAGE_KEY_BUCKET_A, name)
      }
    }
  }, [configData, activeBucket, bucketA])

  const persistBucketA = (v: string) => {
    setBucketA(v)
    localStorage.setItem(STORAGE_KEY_BUCKET_A, v)
  }

  const persistBucketB = (v: string) => {
    setBucketB(v)
    localStorage.setItem(STORAGE_KEY_BUCKET_B, v)
  }

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

  return (
    <div className='space-y-6'>
      {configData && (
        <div className='text-xs text-muted-foreground'>
          Stage: <span className='font-semibold'>{configData.stage}</span>
        </div>
      )}

      {/* Bucket type selector */}
      <div className='flex gap-2'>
        <span className='text-sm text-muted-foreground self-center mr-1'>
          Quick-fill:
        </span>
        {(['mixes', 'userContent'] as const).map((key) => (
          <Button
            key={key}
            variant={activeBucket === key ? 'default' : 'outline'}
            size='sm'
            onClick={() => {
              setActiveBucket(key)
              if (configData) {
                persistBucketA(configData.buckets[key])
              }
            }}>
            {key === 'mixes' ? 'Mixes' : 'User Content'}
          </Button>
        ))}
      </div>

      {/* Bucket name inputs */}
      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-1.5'>
          <Label className='text-xs text-muted-foreground'>Bucket A</Label>
          <Input
            value={bucketA}
            onChange={(e) => persistBucketA(e.target.value)}
            placeholder='Bucket A name'
            className='h-8 text-xs font-mono'
          />
          {configData && (
            <div className='flex flex-wrap gap-1.5'>
              {Object.entries(configData.buckets).map(([name, bucket]) => (
                <button
                  key={name}
                  type='button'
                  onClick={() => persistBucketA(bucket)}
                  className='text-xs text-primary underline-offset-2 hover:underline'>
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className='space-y-1.5'>
          <Label className='text-xs text-muted-foreground'>Bucket B</Label>
          <Input
            value={bucketB}
            onChange={(e) => persistBucketB(e.target.value)}
            placeholder='Other bucket name (e.g. prod bucket)'
            className='h-8 text-xs font-mono'
          />
        </div>
      </div>

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
                  copyMutation.isPending &&
                  copyMutation.variables?.key === key

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
                            disabled={isCopying}
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
                            disabled={isCopying}
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
                              disabled={isCopying || !bucketB}
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
                              disabled={isCopying || !bucketA}
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
