import { Button, Input } from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'
import { useState } from 'react'
import { BlueskyAccount as BlueskyAccountSchema } from '@gbfm/api/bluesky'
import { captureException } from '@/services/analytics'
import { getApiClient } from '@/lib/api-client'

type BlueskyAccount = typeof BlueskyAccountSchema.Type

export function BlueskyConnectionCard() {
  const queryClient = useQueryClient()
  const [handle, setHandle] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const accounts = useQuery<ReadonlyArray<BlueskyAccount>, Error>({
    queryKey: ['integrations', 'bluesky'],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(client.bluesky.listBlueskyAccounts())
    }
  })
  const connect = useMutation({
    mutationFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(client.bluesky.connectBluesky({ payload: { handle, appPassword } }))
    },
    onSuccess: () => {
      setAppPassword('')
      queryClient.invalidateQueries({ queryKey: ['integrations', 'bluesky'] })
    },
    onError: (error) => captureException(error, { endpoint: 'bluesky.connectBluesky' })
  })
  const disconnect = useMutation({
    mutationFn: async (id: string) => {
      const client = await getApiClient()
      return Effect.runPromise(client.bluesky.disconnectBluesky({ params: { id } }))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations', 'bluesky'] }),
    onError: (error) => captureException(error, { endpoint: 'bluesky.disconnectBluesky' })
  })
  const account = accounts.data?.[0]

  return (
    <section className='space-y-6'>
      <div className='space-y-1'>
        <h2 className='text-base font-bold tracking-widest text-muted-foreground'>Bluesky</h2>
        <p className='text-xs font-medium tracking-wider text-muted-foreground'>
          Connect your account to archive music posts as Goosebumps drafts.
        </p>
      </div>

      {accounts.isPending ? (
        <p className='text-xs text-muted-foreground'>Checking connection…</p>
      ) : account ? (
        <div className='w-full max-w-md space-y-4'>
          <div className='flex items-center justify-between gap-6 border-2 border-border p-6'>
            <div className='min-w-0 space-y-2'>
              <div className='truncate text-base font-bold tracking-widest text-foreground'>
                {account.handle ?? account.providerAccountId}
              </div>
              <div className='text-xs font-medium tracking-wider text-muted-foreground'>
                {account.providerAccountId}
              </div>
            </div>
            <span className='text-xs font-bold tracking-widest text-green-500'>
              {account.status === 'active' ? 'Connected' : account.status}
            </span>
          </div>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => disconnect.mutate(account.id)}
            disabled={disconnect.isPending}>
            {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </div>
      ) : (
        <form
          className='w-full max-w-md space-y-3'
          onSubmit={(event) => {
            event.preventDefault()
            connect.mutate()
          }}>
          <Input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder='handle.bsky.social'
            aria-label='Bluesky handle'
            required
          />
          <Input
            type='password'
            value={appPassword}
            onChange={(event) => setAppPassword(event.target.value)}
            placeholder='App password'
            aria-label='Bluesky app password'
            required
          />
          <Button type='submit' size='sm' disabled={connect.isPending}>
            {connect.isPending ? 'Connecting…' : 'Connect Bluesky'}
          </Button>
        </form>
      )}

      {accounts.error || connect.error || disconnect.error ? (
        <p className='text-xs font-medium tracking-wider text-destructive'>
          {(accounts.error ?? connect.error ?? disconnect.error)?.message ?? 'Integration failed'}
        </p>
      ) : null}
    </section>
  )
}
