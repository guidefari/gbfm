import { Card, CardContent } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ContentManager } from '@/components/content/ContentManager'
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
  const view = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <AdminPage
      title='Content'
      description='Operate publishing across mixes, editorials, and tweets from one place.'
      backToAdmin>
      <Card>
        <CardContent className='pt-6'>
          <ContentManager
            scope='all'
            view={view}
            onViewChange={(next) => navigate({ search: next })}
          />
        </CardContent>
      </Card>
    </AdminPage>
  )
}
