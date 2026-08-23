import { createFileRoute } from '@tanstack/react-router'
import { Schema } from 'effect'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'
import { defaultContentView } from '@/components/content/types'
import { dashboardOffsetSearchSchema } from '@/lib/dashboard-search-schema'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'

export const Route = createFileRoute('/dashboard/all/tweets')({
  validateSearch: Schema.toStandardSchemaV1(dashboardOffsetSearchSchema),
  component: AdminTweetsPage
})

function AdminTweetsPage() {
  const { offset } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <ContentPageShell
      title='Tweets'
      description='Short posts, replies, and drafts imported from Bluesky.'
      newLink='tweet'
      guard={(children) => <AdminAccessGuard>{children}</AdminAccessGuard>}>
      <ContentManager
        scope='all'
        view={{ ...defaultContentView, tab: 'tweet', offset }}
        onViewChange={({ offset: nextOffset }) => navigate({ search: { offset: nextOffset } })}
      />
    </ContentPageShell>
  )
}
