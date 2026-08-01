import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { NavItem } from '../NavLinks'

export const navRowClass = cn(
  'flex w-full items-center gap-3 rounded-sm px-3 py-2 text-base font-medium no-underline transition-colors',
  'text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
)

export function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  if (item.external) {
    return (
      <a
        href={item.external}
        target='_blank'
        rel='noreferrer'
        onClick={onNavigate}
        className={navRowClass}>
        <span className='flex h-5 w-5 shrink-0 items-center justify-center'>{item.icon}</span>
        <span className='min-w-0 flex-1 truncate'>{item.name}</span>
      </a>
    )
  }

  if (item.CustomComponent) {
    return (
      <div className={navRowClass}>
        <span className='flex h-5 w-5 shrink-0 items-center justify-center'>
          {item.CustomComponent}
        </span>
        <span className='min-w-0 flex-1 truncate'>{item.name}</span>
      </div>
    )
  }

  return (
    <Link to={item.slug} onClick={onNavigate} className={navRowClass}>
      <span className='flex h-5 w-5 shrink-0 items-center justify-center'>{item.icon}</span>
      <span className='min-w-0 flex-1 truncate'>{item.name}</span>
    </Link>
  )
}

export function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='flex flex-col gap-1'>
      <h2 className='px-3 pb-1 text-xs font-semibold tracking-wider text-muted-foreground'>
        {title}
      </h2>
      {children}
    </section>
  )
}
