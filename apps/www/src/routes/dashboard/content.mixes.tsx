import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { Schema } from 'effect'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'
import { dashboardMixesSearchSchema } from '@/lib/dashboard-search-schema'
import { useNavigate } from '@/lib/navigation'

export const Route = createFileRoute('/dashboard/content/mixes')({
  validateSearch: Schema.toStandardSchemaV1(dashboardMixesSearchSchema),
  component: DashboardMixesPage
})

export const Page = createPageComponent(Route)

function DashboardMixesPage() {
  const { offset, sort, order } = Route.useSearch()
  const navigate = useNavigate()

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
