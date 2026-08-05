import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ContentManager } from '@/components/content/ContentManager'
import { ContentPageShell } from '@/components/content/ContentPageShell'
import { defaultContentView } from '@/components/content/types'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'

const searchSchema = z.object({
  offset: z.coerce.number().int().min(0).catch(0)
})

export const Route = createFileRoute('/dashboard/all/tweets')({
  validateSearch: searchSchema,
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
