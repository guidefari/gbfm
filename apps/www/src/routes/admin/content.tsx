import { Card, CardContent } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ContentTab } from './_components/-ContentTab'
import { AdminPage } from './_components/-AdminLayout'

const searchSchema = z.object({
  tab: z.enum(['mixes', 'editorial', 'tweet']).catch('mixes'),
  offset: z.coerce.number().int().min(0).catch(0),
  sort: z.enum(['plays', 'created']).catch('created'),
  order: z.enum(['asc', 'desc']).catch('desc')
})

export const Route = createFileRoute('/admin/content')({
  validateSearch: searchSchema,
  component: AdminContentPage
})

function AdminContentPage() {
  return (
    <AdminPage
      title='Content'
      description='Operate publishing across mixes, editorials, and tweets from one place.'
      backToAdmin>
      <Card>
        <CardContent className='pt-6'>
          <ContentTab />
        </CardContent>
      </Card>
    </AdminPage>
  )
}
