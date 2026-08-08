import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'
import { defaultContentView } from '@/components/content/types'

const searchSchema = z.object({
  offset: z.coerce.number().int().min(0).catch(0)
})

export const Route = createFileRoute('/dashboard/content/tweets')({
  validateSearch: searchSchema,
  component: DashboardTweetsPage
})

function DashboardTweetsPage() {
  const { offset } = Route.useSearch()
  const navigate = Route.useNavigate()

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
