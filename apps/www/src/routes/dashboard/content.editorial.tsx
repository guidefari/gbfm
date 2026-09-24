import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { Schema } from 'effect'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'
import { defaultContentView } from '@/components/content/types'
import { dashboardOffsetSearchSchema } from '@/lib/dashboard-search-schema'
import { useNavigate } from '@/lib/navigation'

export const Route = createFileRoute('/dashboard/content/editorial')({
  validateSearch: Schema.toStandardSchemaV1(dashboardOffsetSearchSchema),
  component: DashboardEditorialPage
})

export const Page = createPageComponent(Route)

function DashboardEditorialPage() {
  const { offset } = Route.useSearch()
  const navigate = useNavigate()

  return (
    <ContentPageShell
      title='Your editorial'
      description='Drafts stay private until you publish them.'
      newLink='editorial'>
      <ContentManager
        scope='mine'
        view={{ ...defaultContentView, tab: 'editorial', offset }}
        onViewChange={({ offset: nextOffset }) => navigate({ search: { offset: nextOffset } })}
      />
    </ContentPageShell>
  )
}
