import type { ReactNode } from 'react'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { AdminAccessGuard } from './-AdminAccessGuard'

export function AdminPage({
  title,
  description,
  actions,
  children
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
  backToAdmin?: boolean
  maxWidth?: string
}) {
  return (
    <WorkspacePage
      title={title}
      description={description}
      actions={actions}
      guard={(c) => <AdminAccessGuard>{c}</AdminAccessGuard>}>
      {children}
    </WorkspacePage>
  )
}
