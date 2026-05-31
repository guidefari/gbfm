import { Card, CardContent, CardHeader, CardTitle } from './card'

export interface MusicEntityAuditProps {
  createdAt: Date | string
  updatedAt: Date | string
  createdBy?: { name?: string | null; email?: string | null } | null
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export function MusicEntityAudit({ createdAt, updatedAt, createdBy }: MusicEntityAuditProps) {
  const byLine = createdBy?.name ?? createdBy?.email ?? 'Unknown'

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-sm font-medium'>Audit</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className='grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm'>
          <dt className='text-muted-foreground'>Created</dt>
          <dd>{formatDate(createdAt)}</dd>
          <dt className='text-muted-foreground'>Updated</dt>
          <dd>{formatDate(updatedAt)}</dd>
          <dt className='text-muted-foreground'>Imported by</dt>
          <dd>{byLine}</dd>
        </dl>
      </CardContent>
    </Card>
  )
}
