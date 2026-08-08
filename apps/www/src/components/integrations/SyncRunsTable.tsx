import { Badge } from '@gbfm/ui'
import type { BlueskySyncRun as BlueskySyncRunSchema } from '@gbfm/api/bluesky'

type SyncRun = typeof BlueskySyncRunSchema.Type

const statusVariant = (status: SyncRun['status']) =>
  status === 'failed' ? 'destructive' : status === 'running' ? 'secondary' : 'default'

const formatDuration = (run: SyncRun) => {
  if (!run.finishedAt) return '—'
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
  if (ms < 1000) return '<1s'
  const seconds = Math.round(ms / 1000)
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

export function SyncRunsTable({
  runs,
  isPending
}: {
  runs: ReadonlyArray<SyncRun>
  isPending: boolean
}) {
  if (isPending) {
    return <p className='text-xs text-muted-foreground'>Loading recent imports…</p>
  }

  if (runs.length === 0) {
    return (
      <p className='text-xs text-muted-foreground'>
        No imports yet. Run a sync to pull your archive in as drafts.
      </p>
    )
  }

  return (
    <div className='overflow-x-auto rounded-sm border'>
      <table className='w-full text-base'>
        <thead>
          <tr className='border-b bg-muted/50'>
            <th className='px-4 py-3 text-left font-medium'>Started</th>
            <th className='px-4 py-3 text-left font-medium'>Status</th>
            <th className='px-4 py-3 text-left font-medium'>Created</th>
            <th className='px-4 py-3 text-left font-medium'>Already imported</th>
            <th className='px-4 py-3 text-left font-medium'>Conflicts</th>
            <th className='px-4 py-3 text-left font-medium'>Failed</th>
            <th className='px-4 py-3 text-left font-medium'>Duration</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className='border-b hover:bg-muted/50'>
              <td className='px-4 py-3 text-muted-foreground'>
                {new Date(run.startedAt).toLocaleString()}
              </td>
              <td className='px-4 py-3'>
                <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
              </td>
              <td className='px-4 py-3 text-muted-foreground'>{run.created}</td>
              <td className='px-4 py-3 text-muted-foreground'>{run.alreadyImported}</td>
              <td className='px-4 py-3 text-muted-foreground'>{run.conflicted}</td>
              <td className='px-4 py-3 text-muted-foreground'>{run.failed}</td>
              <td className='px-4 py-3 text-muted-foreground'>{formatDuration(run)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
