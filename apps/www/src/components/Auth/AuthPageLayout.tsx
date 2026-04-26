import type { ReactNode } from 'react'
import { LockIcon } from '@/components/common/icons'
import { cn } from '@/lib/utils'

type AuthPageLayoutProps = {
  title: string
  description: string
  badge?: string
  status?: ReactNode
  footer?: ReactNode
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
  children
}: AuthPageLayoutProps) {
  return (
    <div className='relative overflow-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10'>
      <div className='pointer-events-none absolute -top-24 left-[8%] h-64 w-64 rounded-full bg-gb-pastel-green-2/12 blur-3xl' />
      <div className='pointer-events-none absolute right-[10%] top-[18%] h-72 w-72 rounded-full bg-gb-highlight/10 blur-3xl' />
      <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(182,250,223,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(182,250,223,0.04)_1px,transparent_1px)] bg-[size:36px_36px] opacity-25' />

      <div className='relative mx-auto flex w-full max-w-6xl items-start justify-center lg:pt-6'>
        <div className='grid w-full items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,440px)] lg:gap-12'>
          <section className='hidden space-y-6 lg:block'>
            <div className='max-w-xl space-y-4'>
              <h1 className='mt-0 text-4xl font-black tracking-tight text-foreground sm:text-5xl xl:text-6xl'>
                A calmer way back into your listening world.
              </h1>
              <p className='max-w-lg text-base leading-7 text-muted-foreground sm:text-lg'>
                Save favorites, stay notified about new additions to the
                archive.
              </p>
            </div>

            <div className='grid max-w-xl gap-4 sm:grid-cols-2'></div>
          </section>

          <section className='w-full lg:self-start'>
            <div className='mx-auto w-full max-w-md space-y-5'>
              <div className='border border-gb-pastel-green-2/30 bg-gb-darker-bg/65 p-6 shadow-2xl backdrop-blur-sm sm:p-7'>
                <div className='space-y-5'>
                  <div className='space-y-4'>
                    <div className='inline-flex items-center gap-2 border border-gb-pastel-green-2/40 bg-background/70 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-gb-pastel-green-1 uppercase'>
                      <LockIcon className='h-3.5 w-3.5' />
                      {badge}
                    </div>

                    <div className='space-y-2'>
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
