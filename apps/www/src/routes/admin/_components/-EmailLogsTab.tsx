import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@gbfm/ui'
import { useEffect, useMemo, useState } from 'react'
import { type AdminEmailLog, type EmailLogStatus, useAdminEmailLogs } from '@/lib/http'

const PAGE_SIZE = 20
const EMAIL_STATUSES: EmailLogStatus[] = [
  'PENDING',
  'SENT',
  'DELIVERED',
  'BOUNCED',
  'COMPLAINED',
  'FAILED'
]

function isEmailLogStatus(value: string): value is EmailLogStatus {
  return EMAIL_STATUSES.some((status) => status === value)
}

function formatDateTime(value: string | Date | null) {
  if (!value) return '—'

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString()
}

function statusVariant(
  status: EmailLogStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'FAILED' || status === 'BOUNCED' || status === 'COMPLAINED') {
    return 'destructive'
  }

  if (status === 'DELIVERED' || status === 'SENT') {
    return 'secondary'
  }

  return 'outline'
}

export function EmailLogsTab() {
  const [status, setStatus] = useState<EmailLogStatus | 'ALL'>('ALL')
  const [recipientInput, setRecipientInput] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      const normalized = recipientInput.trim()
      setRecipientEmail((previous) => {
        if (previous !== normalized) {
          setOffset(0)
        }
        return normalized
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [recipientInput])

  const { data, error, isPending } = useAdminEmailLogs({
    limit: PAGE_SIZE,
    offset,
    status: status === 'ALL' ? undefined : status,
    recipientEmail: recipientEmail || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  })

  const logs = data?.data ?? []
  const pagination = data?.pagination

  const currentPage = useMemo(() => Math.floor(offset / PAGE_SIZE) + 1, [offset])

  const resetFilters = () => {
    setStatus('ALL')
    setRecipientInput('')
    setRecipientEmail('')
    setDateFrom('')
    setDateTo('')
    setOffset(0)
  }

  const canGoPrevious = offset > 0
  const canGoNext = Boolean(pagination?.hasMore)

  return (
    <div className='space-y-4'>
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-5'>
        <div className='space-y-2'>
          <Label htmlFor='email-log-status'>Status</Label>
          <Select
            value={status}
            onValueChange={(next) => {
              if (next === 'ALL' || isEmailLogStatus(next)) {
                setStatus(next)
              }
              setOffset(0)
            }}>
            <SelectTrigger id='email-log-status'>
              <SelectValue placeholder='All statuses' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='ALL'>All statuses</SelectItem>
              {EMAIL_STATUSES.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {entry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2 md:col-span-2'>
          <Label htmlFor='email-log-recipient'>Recipient Email</Label>
          <Input
            id='email-log-recipient'
            type='text'
            placeholder='Search recipient email'
            value={recipientInput}
            onChange={(event) => setRecipientInput(event.target.value)}
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='email-log-date-from'>Date From (UTC)</Label>
          <Input
            id='email-log-date-from'
            type='date'
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value)
              setOffset(0)
            }}
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='email-log-date-to'>Date To (UTC)</Label>
          <Input
            id='email-log-date-to'
            type='date'
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value)
              setOffset(0)
            }}
          />
        </div>
      </div>

      <div className='flex items-center justify-between gap-3'>
        <p className='text-sm text-muted-foreground'>
          {pagination ? `${pagination.total} total logs` : 'Email delivery logs'}
        </p>
        <Button variant='outline' onClick={resetFilters}>
          Reset Filters
        </Button>
      </div>

      {error ? (
        <div className='rounded-sm border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive'>
          Failed to load email logs: {error.message}
        </div>
      ) : null}

      <div className='overflow-x-auto rounded-sm border'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b bg-muted/50'>
              <th className='px-4 py-3 text-left font-medium'>Created</th>
              <th className='px-4 py-3 text-left font-medium'>Recipient</th>
              <th className='px-4 py-3 text-left font-medium'>Type</th>
              <th className='px-4 py-3 text-left font-medium'>Template</th>
              <th className='px-4 py-3 text-left font-medium'>Subject</th>
              <th className='px-4 py-3 text-left font-medium'>Status</th>
              <th className='px-4 py-3 text-left font-medium'>SES Message ID</th>
              <th className='px-4 py-3 text-left font-medium'>Error</th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={8} className='px-4 py-8 text-center text-muted-foreground'>
                  Loading email logs...
                </td>
              </tr>
            ) : null}

            {!isPending && logs.length === 0 ? (
              <tr>
                <td colSpan={8} className='px-4 py-8 text-center text-muted-foreground'>
                  No email logs match the current filters
                </td>
              </tr>
            ) : null}

            {!isPending
              ? logs.map((log: AdminEmailLog) => (
                  <tr key={log.id} className='border-b hover:bg-muted/50'>
                    <td className='px-4 py-3 text-muted-foreground'>
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className='px-4 py-3'>{log.recipientEmail}</td>
                    <td className='px-4 py-3 text-muted-foreground'>{log.emailType}</td>
                    <td className='px-4 py-3 text-muted-foreground'>{log.templateName}</td>
                    <td className='px-4 py-3'>{log.subject}</td>
                    <td className='px-4 py-3'>
                      <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                    </td>
                    <td className='max-w-[220px] truncate px-4 py-3 text-muted-foreground'>
                      {log.sesMessageId || '—'}
                    </td>
                    <td className='max-w-[260px] truncate px-4 py-3 text-muted-foreground'>
                      {log.errorMessage || '—'}
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <div className='flex items-center justify-between gap-3'>
        <p className='text-sm text-muted-foreground'>
          Page {currentPage}
          {pagination ? ` of ${Math.max(Math.ceil(pagination.total / PAGE_SIZE), 1)}` : ''}
        </p>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={() => setOffset((previous) => Math.max(previous - PAGE_SIZE, 0))}
            disabled={!canGoPrevious || isPending}>
            Previous
          </Button>
          <Button
            variant='outline'
            onClick={() => setOffset((previous) => previous + PAGE_SIZE)}
            disabled={!canGoNext || isPending}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
