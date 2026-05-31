'use client'
import { Button, MenuIcon, Sheet, SheetContent, SheetTrigger } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import React from 'react'
import { navItemsForSurface } from '../NavLinks'

export const HamburgerMenu = () => {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          onClick={() => setOpen(true)}
          size='icon'
          variant='default'
          className='bg-background text-foreground sm:hidden'>
          <MenuIcon className='w-5 h-5' />
          <span className='sr-only'>Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side='left'
        className='flex flex-col sm:max-w-xs space-between'>
        <nav className='grid gap-6 text-lg font-medium'>
          {navItemsForSurface('hamburger').map((page) => {
            if (page.CustomComponent) {
              return (
                <div
                  key={page.id}
                  className='flex gap-4 items-center text-muted-foreground hover:text-foreground'>
                  {page.CustomComponent}
                  {page.name}
                </div>
              )
            }

            if (page.external) {
              return (
                <a
                  key={page.id}
                  href={page.external}
                  target='_blank'
                  rel='noreferrer'
                  onClick={() => setOpen(false)}
                  className='flex gap-4 items-center text-muted-foreground hover:text-foreground'>
                  {page.icon}
                  {page.name}
                </a>
              )
            }

            return (
              <Link
                key={page.id}
                to={page.slug}
                onClick={() => setOpen(false)}
                className='flex gap-4 items-center text-muted-foreground hover:text-foreground'>
                {page.icon}
                {page.name}
              </Link>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
