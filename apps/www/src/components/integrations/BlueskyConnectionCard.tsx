import { Badge, Button } from '@gbfm/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Effect } from 'effect'
import { ArrowRight } from 'lucide-react'
import type { BlueskyAccount as BlueskyAccountSchema } from '@gbfm/api/bluesky'
import { getApiClient } from '@/lib/api-client'

type BlueskyAccount = typeof BlueskyAccountSchema.Type

export function BlueskyConnectionCard() {
  const accounts = useQuery<ReadonlyArray<BlueskyAccount>, Error>({
    queryKey: ['integrations', 'bluesky'],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(client.bluesky.listBlueskyAccounts())
    }
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

      <div className='w-full max-w-md space-y-4'>
        {accounts.isPending ? (
          <p className='text-xs text-muted-foreground'>Checking connection…</p>
        ) : (
          <div className='flex items-center justify-between gap-6 border-2 border-border p-6'>
            <div className='min-w-0 space-y-2'>
              <div className='truncate text-base font-bold tracking-widest text-foreground'>
                {account ? (account.handle ?? account.providerAccountId) : 'Not connected'}
              </div>
              <div className='text-xs font-medium tracking-wider text-muted-foreground'>
                {account
                  ? account.lastSuccessfulSyncAt
                    ? `Last synced ${new Date(account.lastSuccessfulSyncAt).toLocaleDateString()}`
                    : 'Never synced'
                  : 'Set up the import to get started.'}
              </div>
            </div>
            {account ? (
              <Badge variant={account.status === 'active' ? 'default' : 'destructive'}>
                {account.status === 'active' ? 'Connected' : account.status.replace('_', ' ')}
              </Badge>
            ) : null}
          </div>
        )}

        <Button asChild size='sm' variant={account ? 'outline' : 'default'}>
          <Link to='/admin/bluesky'>
            {account ? 'Manage sync and drafts' : 'Connect Bluesky'}
            <ArrowRight className='ml-2 size-4' />
          </Link>
        </Button>
      </div>

      {accounts.error ? (
        <p className='text-xs font-medium tracking-wider text-destructive'>
          {accounts.error.message}
        </p>
      ) : null}
    </section>
  )
}
