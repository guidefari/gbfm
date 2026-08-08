import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'

const searchSchema = z.object({
  offset: z.coerce.number().int().min(0).catch(0),
  sort: z.enum(['plays', 'created']).catch('created'),
  order: z.enum(['asc', 'desc']).catch('desc')
})

export const Route = createFileRoute('/dashboard/content/mixes')({
  validateSearch: searchSchema,
  component: DashboardMixesPage
})

function DashboardMixesPage() {
  const { offset, sort, order } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <ContentPageShell title='Your mixes' description='Drafts stay private until you publish them.'>
      <ContentManager
        scope='mine'
        view={{ tab: 'mixes', offset, sort, order }}
        onViewChange={({ offset: nextOffset, sort: nextSort, order: nextOrder }) =>
          navigate({ search: { offset: nextOffset, sort: nextSort, order: nextOrder } })
        }
      />
    </ContentPageShell>
  )
}
