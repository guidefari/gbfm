import { canCreatePosts } from '@gbfm/core/roles'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { ContentManager } from '@/components/content/ContentManager'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { signInRedirect } from '@/lib/route-guards'

export const Route = createFileRoute('/dashboard/content')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw signInRedirect(location.href)
    }
    if (!canCreatePosts(context.auth.user?.role)) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: DashboardContent
})

function DashboardContent() {
  return (
    <DashboardLayout
      title='Content'
      description='Your mixes, editorials, and tweets. Drafts stay private until you publish them.'>
      <ContentManager scope='mine' />
    </DashboardLayout>
  )
}
