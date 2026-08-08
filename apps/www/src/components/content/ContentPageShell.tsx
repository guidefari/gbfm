import { Button } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'

const newContentLinks = {
  editorial: { to: '/new/editorial', label: 'New editorial' },
  tweet: { to: '/new/tweet', label: 'New tweet' }
} as const

export function ContentPageShell({
  title,
  description,
  newLink,
  guard,
  children
}: {
  title: string
  description: string
  newLink?: keyof typeof newContentLinks
  guard?: (children: ReactNode) => ReactNode
  children: ReactNode
}) {
  const action = newLink ? newContentLinks[newLink] : undefined

  return (
    <WorkspacePage
      title={title}
      description={description}
      guard={guard}
      actions={
        action ? (
          <Button asChild size='sm'>
            <Link to={action.to} search={{ edit: undefined }}>
              <Plus className='mr-2 size-4' />
              {action.label}
            </Link>
          </Button>
        ) : undefined
      }>
      {children}
    </WorkspacePage>
  )
}
