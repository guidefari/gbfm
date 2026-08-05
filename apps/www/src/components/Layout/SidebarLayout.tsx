import { Button, cn, ScrollArea, Sheet, SheetContent, SheetTitle, SheetTrigger } from '@gbfm/ui'
import { Link, type LinkProps, useLocation } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { Menu } from 'lucide-react'
import { type ReactNode, useState } from 'react'

export type SidebarNavItem = {
  to: LinkProps['to']
  label: string
  description?: string
  icon: LucideIcon
}

export function SidebarNavLink({
  item,
  onNavigate
}: {
  item: Pick<SidebarNavItem, 'to' | 'label' | 'icon'>
  onNavigate?: () => void
}) {
  const pathname = useLocation().pathname
  const isActive = pathname === item.to
  const Icon = item.icon

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-sm px-3 py-2 text-base font-medium transition-colors',
        'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive ? 'bg-foreground text-background hover:bg-foreground' : 'text-foreground'
      )}>
      <Icon className='h-4 w-4 shrink-0' />
      <span className='truncate'>{item.label}</span>
    </Link>
  )
}

export function SidebarNavGroup({
  title,
  items,
  onNavigate
}: {
  title: string
  items: SidebarNavItem[]
  onNavigate?: () => void
}) {
  return (
    <div className='space-y-1'>
      <div className='px-3 pb-1 text-xs font-semibold tracking-[0.18em] text-muted-foreground'>
        {title}
      </div>
      {items.map((item) => (
        <SidebarNavLink key={item.to} item={item} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

export function SidebarLayout({
  brand,
  nav,
  title,
  description,
  actions,
  children,
  guard
}: {
  brand: string
  nav: (props: { onNavigate?: () => void }) => ReactNode
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  guard?: (children: ReactNode) => ReactNode
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const content = (
    <div className='flex min-h-full'>
      <aside className='sticky top-0 hidden h-[calc(100dvh-3rem)] w-64 shrink-0 self-start border-r lg:block'>
        <div className='border-b px-4 py-4 text-base font-black tracking-[0.18em]'>{brand}</div>
        <ScrollArea className='h-[calc(100dvh-6.5rem)]'>
          <nav aria-label={brand} className='flex flex-col gap-6 p-4'>
            {nav({})}
          </nav>
        </ScrollArea>
      </aside>

      <div className='min-w-0 flex-1'>
        <div className='container mx-auto max-w-5xl space-y-6 px-4 py-8'>
          <div className='flex flex-col gap-4'>
            <div className='lg:hidden'>
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant='outline' size='sm'>
                    <Menu className='mr-2 h-4 w-4' />
                    {brand} menu
                  </Button>
                </SheetTrigger>
                <SheetContent side='left' className='w-72 p-0'>
                  <SheetTitle className='border-b px-4 py-4 text-base font-black tracking-[0.18em]'>
                    {brand}
                  </SheetTitle>
                  <ScrollArea className='h-[calc(100vh-3.5rem)]'>
                    <nav aria-label={brand} className='flex flex-col gap-6 p-4'>
                      {nav({ onNavigate: () => setMobileNavOpen(false) })}
                    </nav>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>

            <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
              <div className='max-w-3xl'>
                <h1 className='text-3xl font-black tracking-tight'>{title}</h1>
                {description ? <p className='mt-2 text-muted-foreground'>{description}</p> : null}
              </div>
              {actions ? <div className='flex flex-wrap gap-2'>{actions}</div> : null}
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  )

  return guard ? guard(content) : content
}
