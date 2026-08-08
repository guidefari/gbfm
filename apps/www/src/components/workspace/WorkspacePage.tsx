import { canCreatePosts } from '@gbfm/core/roles'
import type { ReactNode } from 'react'
import { SidebarLayout, SidebarNavGroup } from '@/components/Layout/SidebarLayout'
import { useSession } from '@/lib/auth-client'
import { type WorkspaceAccess, workspaceNav } from './nav'

function canSee(access: WorkspaceAccess, role: string | null | undefined) {
  if (access === 'admin') return role === 'admin'
  if (access === 'postCreate') return canCreatePosts(role)
  return true
}

function WorkspaceNav({
  role,
  onNavigate
}: {
  role: string | null | undefined
  onNavigate?: () => void
}) {
  return (
    <>
      {workspaceNav.map((group) => {
        const items = group.items.filter((item) => canSee(item.access, role))
        if (items.length === 0) return null

        return (
          <SidebarNavGroup
            key={group.title}
            title={group.title}
            items={items}
            onNavigate={onNavigate}
          />
        )
      })}
    </>
  )
}

export function WorkspacePage({
  title,
  description,
  actions,
  children,
  guard
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  guard?: (children: ReactNode) => ReactNode
}) {
  const { data: session } = useSession()
  const role = session?.user.role

  return (
    <SidebarLayout
      brand='Studio'
      nav={({ onNavigate }) => <WorkspaceNav role={role} onNavigate={onNavigate} />}
      title={title}
      description={description}
      actions={actions}
      guard={guard}>
      {children}
    </SidebarLayout>
  )
}
