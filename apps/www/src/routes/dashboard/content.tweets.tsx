import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { Schema } from 'effect'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'
import { defaultContentView } from '@/components/content/types'
import { dashboardOffsetSearchSchema } from '@/lib/dashboard-search-schema'
import { useNavigate } from '@/lib/navigation'

export const Route = createFileRoute('/dashboard/content/tweets')({
  validateSearch: Schema.toStandardSchemaV1(dashboardOffsetSearchSchema),
  component: DashboardTweetsPage
})

export const Page = createPageComponent(Route)

function DashboardTweetsPage() {
  const { offset } = Route.useSearch()
  const navigate = useNavigate()

  return (
    <ContentPageShell
      title='Your tweets'
      description='Drafts stay private until you publish them.'
      newLink='tweet'>
      <ContentManager
        scope='mine'
        view={{ ...defaultContentView, tab: 'tweet', offset }}
        onViewChange={({ offset: nextOffset }) => navigate({ search: { offset: nextOffset } })}
      />
    </ContentPageShell>
  )
}
