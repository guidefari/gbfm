import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { useCallback, useEffect, useState } from 'react'
import type { BlueskyAccount as BlueskyAccountSchema } from '@gbfm/api/bluesky'
import { getApiClient } from '@/lib/api-client'
import { fetcher } from '@/lib/http'
import { apiUrl } from '@/lib/http-url'
import { captureException } from '@/services/analytics'

export type BlueskyAccount = typeof BlueskyAccountSchema.Type

export type SyncProgress = {
  status: 'running' | 'succeeded' | 'failed'
  done: boolean
  created: number
  conflicted: number
  failed: number
  unresolved?: number
}

const SYNC_POLL_INTERVAL_MS = 1500

const accountsQueryKey = ['integrations', 'bluesky'] as const

export function useBlueskySync() {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)

  const accounts = useQuery<ReadonlyArray<BlueskyAccount>, Error>({
    queryKey: accountsQueryKey,
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(client.bluesky.listBlueskyAccounts())
    }
  })

  const account = accounts.data?.[0]

  const invalidateImported = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: accountsQueryKey })
    queryClient.invalidateQueries({ queryKey: ['admin', 'bluesky', 'imported'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] })
  }, [queryClient])

  const connect = useMutation({
    mutationFn: async (input: { handle: string; appPassword: string }) => {
      const client = await getApiClient()
      return Effect.runPromise(client.bluesky.connectBluesky({ payload: input }))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsQueryKey }),
    onError: (err) => captureException(err, { endpoint: 'bluesky.connectBluesky' })
  })

  const sync = useMutation({
    mutationFn: async (id: string) => {
      const client = await getApiClient()
      return Effect.runPromise(client.bluesky.syncBluesky({ params: { id } }))
    },
    onSuccess: (handle) => {
      setError(null)
      setProgress({ status: 'running', done: false, created: 0, conflicted: 0, failed: 0 })
      setRunId(handle.runId)
    },
    onError: (err) => {
      setError(err.message)
      captureException(err, { endpoint: 'bluesky.syncBluesky' })
    }
  })

  const schedule = useMutation({
    mutationFn: async ({ id, scheduled }: { id: string; scheduled: boolean }) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.bluesky.scheduleBluesky({ params: { id }, payload: { scheduled } })
      )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountsQueryKey }),
    onError: (err) => captureException(err, { endpoint: 'bluesky.scheduleBluesky' })
  })

  const disconnect = useMutation({
    mutationFn: async (id: string) => {
      const client = await getApiClient()
      return Effect.runPromise(client.bluesky.disconnectBluesky({ params: { id } }))
    },
    onSuccess: () => {
      setProgress(null)
      setRunId(null)
      invalidateImported()
    },
    onError: (err) => captureException(err, { endpoint: 'bluesky.disconnectBluesky' })
  })

  useEffect(() => {
    if (!account || !runId) return

    let cancelled = false

    const pollOnce = async () => {
      try {
        const update = await fetcher<SyncProgress>(
          apiUrl(`/integrations/bluesky/${account.id}/sync/${runId}/status`)
        )
        if (cancelled) return
        setProgress(update)
        if (update.done) {
          if (update.status === 'succeeded') invalidateImported()
          else if (update.status === 'failed')
            setError('Import failed. Try running the sync again.')
          clearInterval(intervalId)
        }
      } catch {
        if (cancelled) return
        setError('Connection interrupted while polling sync updates.')
        clearInterval(intervalId)
      }
    }

    const intervalId = setInterval(pollOnce, SYNC_POLL_INTERVAL_MS)
    void pollOnce()

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [account, invalidateImported, runId])

  const isSyncing = sync.isPending || progress?.status === 'running'

  return {
    account,
    accountsPending: accounts.isPending,
    connect,
    sync,
    schedule,
    disconnect,
    progress,
    isSyncing,
    error: error ?? accounts.error?.message ?? connect.error?.message ?? null
  }
}
