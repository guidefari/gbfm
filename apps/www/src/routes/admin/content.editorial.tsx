import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'
import { defaultContentView } from '@/components/content/types'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'

const searchSchema = z.object({
  offset: z.coerce.number().int().min(0).catch(0)
})

export const Route = createFileRoute('/admin/content/editorial')({
  validateSearch: searchSchema,
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
