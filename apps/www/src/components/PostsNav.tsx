import { Link } from '@tanstack/react-router'

type Tab = 'tweets' | 'editorial'

const tabs: { id: Tab; label: string; to: '/tweet' | '/editorial' }[] = [
  { id: 'tweets', label: 'Tweets', to: '/tweet' },
  { id: 'editorial', label: 'Editorial', to: '/editorial' }
]

export function PostsNav({ active }: { active: Tab }) {
  return (
    <nav className='mb-6 flex items-end gap-6 border-b border-border/40'>
      {tabs.map((t) => {
        const isActive = t.id === active
        return (
          <Link
            key={t.id}
            to={t.to}
            className={`-mb-px border-b-2 pb-3 text-lg font-black tracking-tight transition-colors ${
              isActive
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground/60 hover:border-border hover:text-foreground'
            }`}>
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
