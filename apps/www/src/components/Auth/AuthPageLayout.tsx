import { LockIcon } from '@gbfm/ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type AuthPageLayoutProps = {
  title: string
  description: string
  badge?: string
  status?: ReactNode
  footer?: ReactNode
  aside?: ReactNode
  children: ReactNode
}

type AuthStatusNoticeProps = {
  variant: 'error' | 'success'
  children: ReactNode
}

export function AuthPageLayout({
  title,
  description,
  badge = 'Listener Access',
  status,
  footer,
  aside,
  children
}: AuthPageLayoutProps) {
  return (
    <div className='relative min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10'>
      <div className='pointer-events-none fixed inset-0 overflow-hidden'>
        <div className='bg-vinyl-rings absolute left-1/2 top-1/2 aspect-square w-[160vmax] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07]' />
        <div className='absolute -top-24 left-[8%] h-64 w-64 rounded-full bg-gb-pastel-green-2/12 blur-3xl' />
        <div className='absolute right-[10%] top-[18%] h-72 w-72 rounded-full bg-gb-highlight/10 blur-3xl' />
      </div>

      <div className='relative mx-auto flex w-full min-w-0 max-w-6xl items-start justify-center lg:pt-6'>
        <div className='grid w-full min-w-0 items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,440px)] lg:gap-12'>
          <section className='hidden space-y-6 lg:block'>
            <div className='max-w-xl space-y-4'>
              <h1 className='mt-0 text-5xl font-black tracking-tight text-foreground sm:text-6xl xl:text-7xl'>
                {title}
              </h1>
              <p className='max-w-lg text-base leading-7 text-muted-foreground sm:text-lg'>
                {description}
              </p>
            </div>
            {aside ? <div className='max-w-md pt-2'>{aside}</div> : null}
          </section>

          <section className='min-w-0 w-full lg:self-start'>
            <div className='mx-auto w-full min-w-0 max-w-md space-y-5'>
              <div className='border border-gb-pastel-green-2/30 bg-gb-darker-bg/65 p-6 backdrop-blur-sm sm:p-7 lg:shadow-2xl'>
                <div className='space-y-5'>
                  <div className='space-y-4'>
                    <div className='inline-flex items-center gap-2 border border-gb-pastel-green-2/40 bg-background/70 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-gb-pastel-green-1 uppercase'>
                      <LockIcon className='h-3.5 w-3.5' />
                      {badge}
                    </div>

                    <div className='space-y-2 lg:hidden'>
                      <h2 className='mt-0 text-3xl font-black tracking-tight text-foreground'>
                        {title}
                      </h2>
                      <p className='text-sm leading-6 text-muted-foreground sm:text-base'>
                        {description}
                      </p>
                    </div>
                  </div>

                  {status}
                  {children}
                  {footer}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export function AuthStatusNotice({ variant, children }: AuthStatusNoticeProps) {
  return (
    <div
      className={cn(
        'border px-4 py-3 text-sm leading-6 backdrop-blur-sm',
        variant === 'success'
          ? 'border-gb-pastel-green-2/45 bg-gb-pastel-green-2/15 text-gb-pastel-green-1'
          : 'border-red-500/35 bg-red-500/10 text-red-200'
      )}>
      {children}
    </div>
  )
}
