import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'
import { defaultContentView } from '@/components/content/types'

const searchSchema = z.object({
  offset: z.coerce.number().int().min(0).catch(0)
})

export const Route = createFileRoute('/dashboard/content/editorial')({
  validateSearch: searchSchema,
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
