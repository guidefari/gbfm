import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { Schema } from 'effect'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'
import { dashboardMixesSearchSchema } from '@/lib/dashboard-search-schema'
import { useNavigate } from '@/lib/navigation'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'

export const Route = createFileRoute('/dashboard/all/mixes')({
  validateSearch: Schema.toStandardSchemaV1(dashboardMixesSearchSchema),
  component: AdminMixesPage
})

export const Page = createPageComponent(Route)

function AdminMixesPage() {
  const { offset, sort, order } = Route.useSearch()
  const navigate = useNavigate()

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
