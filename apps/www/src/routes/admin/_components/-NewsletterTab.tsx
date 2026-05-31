import { Badge } from '@gbfm/ui'
import { useAdminNewsletterSubscribers } from '@/lib/http'

export function NewsletterTab() {
  const { data, isPending, isError } = useAdminNewsletterSubscribers()

  if (isPending) {
    return <p className='text-sm text-muted-foreground'>Loading...</p>
  }

  if (isError) {
    return <p className='text-sm text-destructive'>Failed to load subscribers.</p>
  }

  const subscribers = data?.subscribers ?? []

  return (
    <div className='space-y-4'>
      <p className='text-sm text-muted-foreground'>
        {subscribers.length} subscriber{subscribers.length !== 1 ? 's' : ''}
      </p>

      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b text-left text-muted-foreground'>
              <th className='pb-2 pr-4 font-medium'>Email</th>
              <th className='pb-2 pr-4 font-medium'>Name</th>
              <th className='pb-2 pr-4 font-medium'>Source</th>
              <th className='pb-2 pr-4 font-medium'>Status</th>
              <th className='pb-2 font-medium'>Subscribed</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((sub) => (
              <tr key={sub.id} className='border-b last:border-0'>
                <td className='py-2 pr-4'>{sub.email}</td>
                <td className='py-2 pr-4 text-muted-foreground'>{sub.name ?? '-'}</td>
                <td className='py-2 pr-4 text-muted-foreground'>{sub.source ?? '-'}</td>
                <td className='py-2 pr-4'>
                  {sub.unsubscribedAt ? (
                    <Badge variant='destructive'>Unsubscribed</Badge>
                  ) : (
                    <Badge variant='secondary'>Active</Badge>
                  )}
                </td>
                <td className='py-2 text-muted-foreground'>
                  {new Date(sub.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
