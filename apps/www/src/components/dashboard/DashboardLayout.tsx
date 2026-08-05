import type { ReactNode } from 'react'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { useSession } from '@/lib/auth-client'

function DashboardGuard({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className='flex min-h-[50vh] items-center justify-center p-4 font-jetbrains'>
        <div className='text-muted-foreground'>Loading...</div>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className='flex min-h-[50vh] items-center justify-center p-4 font-jetbrains'>
        <div className='text-center'>
          <p className='mb-4 text-lg text-muted-foreground'>
            Please sign in to access your dashboard
          </p>
          <a
            href='/auth/sign-in'
            className='inline-flex items-center justify-center rounded-sm bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:bg-primary/90'>
            Sign In
          </a>
        </div>
      </div>
    )
  }

  return children
}

export function DashboardLayout({
  title,
  description,
  actions,
  children
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <WorkspacePage
      title={title}
      description={description}
      actions={actions}
      guard={(content) => <DashboardGuard>{content}</DashboardGuard>}>
      {children}
    </WorkspacePage>
  )
}
