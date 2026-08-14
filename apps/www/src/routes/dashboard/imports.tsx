import type {
  BlueskyAccount as BlueskyAccountSchema,
  BlueskyPostSource as BlueskyPostSourceSchema,
  BlueskySyncRun as BlueskySyncRunSchema
} from '@gbfm/api/bluesky'
import { canCreatePosts } from '@gbfm/core/roles'
import { toast } from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Effect } from 'effect'
import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { BlueskyConnectionCard } from '@/components/integrations/BlueskyConnectionCard'
import { NeedsAttentionList } from '@/components/integrations/NeedsAttentionList'
import { SyncRunsTable } from '@/components/integrations/SyncRunsTable'
import { getApiClient } from '@/lib/api-client'
import { signInRedirect } from '@/lib/route-guards'
import { captureException } from '@/services/analytics'

type BlueskyAccount = typeof BlueskyAccountSchema.Type
type SyncRun = typeof BlueskySyncRunSchema.Type
type PostSource = typeof BlueskyPostSourceSchema.Type

const ATTENTION_STATUSES = 'conflict,error,unavailable'

export const Route = createFileRoute('/dashboard/imports')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw signInRedirect(location.href)
    }
    if (!canCreatePosts(context.auth.user?.role)) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: DashboardImports
})

function Section({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className='space-y-4'>
      <div className='space-y-1'>
        <h2 className='text-base font-bold tracking-widest text-muted-foreground'>{title}</h2>
        <p className='text-xs font-medium tracking-wider text-muted-foreground'>{description}</p>
      </div>
      {children}
    </section>
  )
}

function ImportActivity({ account }: { account: BlueskyAccount }) {
  const queryClient = useQueryClient()
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  const runs = useQuery<ReadonlyArray<SyncRun>, Error>({
    queryKey: ['integrations', 'bluesky', account.id, 'runs'],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.bluesky.listBlueskySyncRuns({ params: { id: account.id }, query: { limit: 10 } })
      )
    }
  })

  const sources = useQuery<ReadonlyArray<PostSource>, Error>({
    queryKey: ['integrations', 'bluesky', account.id, 'sources', ATTENTION_STATUSES],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.bluesky.listBlueskySources({
          params: { id: account.id },
          query: { status: ATTENTION_STATUSES, limit: 50 }
        })
      )
    }
  })

  const dismiss = useMutation({
    mutationFn: async (sourceId: string) => {
      const client = await getApiClient()
      return Effect.runPromise(
        client.bluesky.updateBlueskySourceStatus({
          params: { sourceId },
          payload: { sourceStatus: 'dismissed' }
        })
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['integrations', 'bluesky', account.id, 'sources', ATTENTION_STATUSES]
      })
      toast({ title: 'Dismissed' })
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to dismiss', description: error.message, variant: 'destructive' })
      Effect.runSync(captureException(error, { endpoint: 'bluesky.updateBlueskySourceStatus' }))
    },
    onSettled: () => setDismissingId(null)
  })

  return (
    <>
      <Section title='Needs attention' description='Imports that stopped short of a clean draft.'>
        <NeedsAttentionList
          sources={sources.data ?? []}
          isPending={sources.isPending}
          dismissingId={dismissingId}
          onDismiss={(sourceId) => {
            setDismissingId(sourceId)
            dismiss.mutate(sourceId)
          }}
        />
      </Section>

      <Section title='Recent imports' description='What each sync run pulled in.'>
        <SyncRunsTable runs={runs.data ?? []} isPending={runs.isPending} />
      </Section>
    </>
  )
}

function DashboardImports() {
  const accounts = useQuery<ReadonlyArray<BlueskyAccount>, Error>({
    queryKey: ['integrations', 'bluesky'],
    queryFn: async () => {
      const client = await getApiClient()
      return Effect.runPromise(client.bluesky.listBlueskyAccounts())
    }
  })
  const account = accounts.data?.[0]

  return (
    <DashboardLayout
      title='Imports'
      description='Bring your Bluesky music posts in as drafts, then review them before publishing.'>
      <div className='space-y-12'>
        <BlueskyConnectionCard />

        {account ? (
          <ImportActivity account={account} />
        ) : (
          <p className='text-xs text-muted-foreground'>
            Connect an account above to see import history here.
          </p>
        )}

        <Section title='Imported drafts' description='Everything imports create lands as a draft.'>
          <Link to='/dashboard/content' className='text-sm underline'>
            Review your drafts in Content →
          </Link>
        </Section>
      </div>
    </DashboardLayout>
  )
}
