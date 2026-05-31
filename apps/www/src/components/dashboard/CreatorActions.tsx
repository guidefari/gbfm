import { Card, CardContent } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import { Disc3, MessageSquare, Newspaper, Tag, Upload } from 'lucide-react'
import { useSession } from '@/lib/auth-client'

type CreatorAction = {
  id: string
  label: string
  description: string
  to: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const actions: CreatorAction[] = [
  {
    id: 'mix',
    label: 'New mix',
    description: 'Upload a DJ mix with artwork and tracklist timestamps.',
    to: '/mix-upload',
    icon: <Disc3 className='w-6 h-6' />
  },
  {
    id: 'tweet',
    label: 'New tweet',
    description: 'Capture a tweet into the editorial feed.',
    to: '/new/tweet',
    icon: <MessageSquare className='w-6 h-6' />,
    adminOnly: true
  },
  {
    id: 'editorial',
    label: 'New editorial',
    description: 'Write a long-form editorial post.',
    to: '/new/editorial',
    icon: <Newspaper className='w-6 h-6' />,
    adminOnly: true
  },
  {
    id: 'label',
    label: 'New label',
    description: 'Add a record label profile.',
    to: '/label-upload',
    icon: <Tag className='w-6 h-6' />,
    adminOnly: true
  }
]

export function CreatorActions() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'

  const visibleActions = actions.filter(
    (action) => !action.adminOnly || isAdmin
  )

  return (
    <section className='space-y-4'>
      <h3 className='text-sm font-bold tracking-widest uppercase text-muted-foreground'>
        Create
      </h3>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {visibleActions.map((action) => (
          <Link key={action.id} to={action.to} className='no-underline group'>
            <Card className='h-full transition-colors hover:border-foreground'>
              <CardContent className='flex flex-col gap-3 py-6'>
                <div className='flex items-center gap-3'>
                  <span className='text-foreground'>{action.icon}</span>
                  <span className='text-lg font-semibold'>{action.label}</span>
                </div>
                <p className='text-sm text-muted-foreground'>
                  {action.description}
                </p>
                <span className='inline-flex items-center gap-1 mt-auto text-xs font-medium tracking-widest uppercase text-primary'>
                  <Upload className='w-3 h-3' />
                  Start
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
