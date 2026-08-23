import { createFileRoute } from '@tanstack/react-router'
import { Schema } from 'effect'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'
import { defaultContentView } from '@/components/content/types'
import { dashboardOffsetSearchSchema } from '@/lib/dashboard-search-schema'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'

export const Route = createFileRoute('/dashboard/all/editorial')({
  validateSearch: Schema.toStandardSchemaV1(dashboardOffsetSearchSchema),
  component: AdminEditorialPage
})

function AdminEditorialPage() {
  const { offset } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <ContentPageShell
      title='Editorial'
      description='Long form posts, drafts, and publishing state.'
      newLink='editorial'
      guard={(children) => <AdminAccessGuard>{children}</AdminAccessGuard>}>
      <ContentManager
        scope='all'
        view={{ ...defaultContentView, tab: 'editorial', offset }}
        onViewChange={({ offset: nextOffset }) => navigate({ search: { offset: nextOffset } })}
      />
    </ContentPageShell>
  )
}
