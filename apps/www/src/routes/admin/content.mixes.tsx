import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'

const searchSchema = z.object({
  offset: z.coerce.number().int().min(0).catch(0),
  sort: z.enum(['plays', 'created']).catch('created'),
  order: z.enum(['asc', 'desc']).catch('desc')
})

export const Route = createFileRoute('/admin/content/mixes')({
  validateSearch: searchSchema,
  component: AdminMixesPage
})

function AdminMixesPage() {
  const { offset, sort, order } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <ContentPageShell
      title='Mixes'
      description='Audio, artwork, and publishing state for every mix.'
      guard={(children) => <AdminAccessGuard>{children}</AdminAccessGuard>}>
      <ContentManager
        scope='all'
        view={{ tab: 'mixes', offset, sort, order }}
        onViewChange={({ offset: nextOffset, sort: nextSort, order: nextOrder }) =>
          navigate({ search: { offset: nextOffset, sort: nextSort, order: nextOrder } })
        }
      />
    </ContentPageShell>
  )
}
