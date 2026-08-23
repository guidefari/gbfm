import { createFileRoute } from '@tanstack/react-router'
import { Schema } from 'effect'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'
import { dashboardMixesSearchSchema } from '@/lib/dashboard-search-schema'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'

export const Route = createFileRoute('/dashboard/all/mixes')({
  validateSearch: Schema.toStandardSchemaV1(dashboardMixesSearchSchema),
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
