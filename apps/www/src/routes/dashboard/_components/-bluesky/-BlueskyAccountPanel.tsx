import { Badge, Button } from '@gbfm/ui'
import { Check, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import type { BlueskyAccount, SyncProgress } from './useBlueskySync'

function SyncProgressLine({ progress }: { progress: SyncProgress }) {
  if (progress.status === 'failed') {
    return (
      <p className='flex items-center gap-2 text-sm text-destructive'>
        <TriangleAlert className='size-4' />
        Import failed after {progress.created} drafts.
      </p>
    )
  }

  const isRunning = progress.status === 'running'
  return (
    <p className='flex items-center gap-2 text-sm text-muted-foreground'>
      {isRunning ? (
        <Loader2 className='size-4 animate-spin' />
      ) : (
        <Check className='size-4 text-green-500' />
      )}
      <span>
        {isRunning ? 'Importing…' : 'Import complete.'} {progress.created} drafts created
        {progress.conflicted > 0 ? `, ${progress.conflicted} conflicts` : ''}
        {progress.failed > 0 ? `, ${progress.failed} failed` : ''}.
      </span>
    </p>
  )
}

function lastSyncedLabel(lastSuccessfulSyncAt: string | null) {
  if (!lastSuccessfulSyncAt) return 'Never synced'
  return `Last synced ${new Date(lastSuccessfulSyncAt).toLocaleString()}`
}

export function BlueskyAccountPanel({
  account,
  progress,
  isSyncing,
  error,
  onSync,
  onToggleSchedule,
  onDisconnect,
  isScheduling,
  isDisconnecting
}: {
  account: BlueskyAccount
  progress: SyncProgress | null
  isSyncing: boolean
  error: string | null
  onSync: () => void
  onToggleSchedule: () => void
  onDisconnect: () => void
  isScheduling: boolean
  isDisconnecting: boolean
}) {
  return (
    <div className='rounded-sm border border-border p-6'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='min-w-0 space-y-1'>
          <div className='flex items-center gap-2'>
            <span className='truncate text-lg font-medium'>
              {account.handle ?? account.providerAccountId}
            </span>
            <Badge variant={account.status === 'active' ? 'default' : 'destructive'}>
              {account.status === 'active' ? 'Connected' : account.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className='text-sm text-muted-foreground'>
            {lastSyncedLabel(account.lastSuccessfulSyncAt)}
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Button onClick={onSync} disabled={isSyncing}>
            <RefreshCw className={`mr-2 size-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing…' : 'Sync now'}
          </Button>
          <Button variant='outline' onClick={onToggleSchedule} disabled={isScheduling}>
            {account.scheduled ? 'Hourly sync on' : 'Hourly sync off'}
          </Button>
          <Button variant='ghost' onClick={onDisconnect} disabled={isDisconnecting}>
            {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </div>
      </div>

      {progress || error ? (
        <div className='mt-4 space-y-1 border-t border-border pt-4'>
          {progress ? <SyncProgressLine progress={progress} /> : null}
          {error ? <p className='text-sm text-destructive'>{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
