import { createFileRoute } from '@tanstack/react-router'
import { Schema } from 'effect'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'
import { defaultContentView } from '@/components/content/types'
import { dashboardOffsetSearchSchema } from '@/lib/dashboard-search-schema'

export const Route = createFileRoute('/dashboard/content/editorial')({
  validateSearch: Schema.toStandardSchemaV1(dashboardOffsetSearchSchema),
  component: DashboardEditorialPage
})

function DashboardEditorialPage() {
  const { offset } = Route.useSearch()
  const navigate = Route.useNavigate()

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
