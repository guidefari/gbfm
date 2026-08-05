import { Skeleton } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { AdminPage } from './_components/-AdminLayout'
import { BlueskyAccountPanel } from './_components/-bluesky/-BlueskyAccountPanel'
import { BlueskyConnectPanel } from './_components/-bluesky/-BlueskyConnectPanel'
import { ImportedDraftsList } from './_components/-bluesky/-ImportedDraftsList'
import { useBlueskySync } from './_components/-bluesky/useBlueskySync'

export const Route = createFileRoute('/admin/bluesky')({
  component: AdminBlueskyPage
})

function AdminBlueskyPage() {
  const {
    account,
    accountsPending,
    connect,
    sync,
    schedule,
    disconnect,
    progress,
    isSyncing,
    error
  } = useBlueskySync()

  return (
    <AdminPage
      title='Bluesky'
      description='Connect your account, sync your archive, and review imported drafts in one place.'>
      <div className='space-y-8'>
        {accountsPending ? (
          <Skeleton className='h-32 w-full' />
        ) : account ? (
          <>
            <BlueskyAccountPanel
              account={account}
              progress={progress}
              isSyncing={isSyncing}
              error={error}
              onSync={() => sync.mutate(account.id)}
              onToggleSchedule={() =>
                schedule.mutate({ id: account.id, scheduled: !account.scheduled })
              }
              onDisconnect={() => disconnect.mutate(account.id)}
              isScheduling={schedule.isPending}
              isDisconnecting={disconnect.isPending}
            />
            <ImportedDraftsList />
          </>
        ) : (
          <BlueskyConnectPanel
            onConnect={connect.mutate}
            isPending={connect.isPending}
            error={error}
          />
        )}
      </div>
    </AdminPage>
  )
}
