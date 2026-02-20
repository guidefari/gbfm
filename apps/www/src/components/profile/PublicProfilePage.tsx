import { ProfileContentGrid } from '@/components/profile/ProfileContentGrid'
import { ProfileUserColumn } from '@/components/profile/ProfileUserColumn'
import type { PublicProfile } from '@/lib/http'

export function PublicProfilePage({ profile }: { profile: PublicProfile }) {
  return (
    <div className='flex flex-col lg:flex-row lg:items-start lg:gap-6 lg:p-6'>
      <aside className='w-full shrink-0 lg:w-80 xl:w-[320px]'>
        <ProfileUserColumn profile={profile} />
      </aside>
      <main className='min-w-0 flex-1 px-4 py-4 lg:px-0 lg:py-0'>
        <ProfileContentGrid content={profile.content} />
      </main>
    </div>
  )
}

export function PublicProfilePageSkeleton() {
  return (
    <div className='flex flex-col lg:flex-row lg:items-start lg:gap-6 lg:p-6'>
      <aside className='w-full shrink-0 p-4 lg:w-80 lg:p-0'>
        <div className='flex items-start gap-4'>
          <div className='h-24 w-24 shrink-0 animate-pulse rounded-sm bg-muted' />
          <div className='flex flex-col gap-2'>
            <div className='h-6 w-32 animate-pulse rounded bg-muted' />
            <div className='h-4 w-24 animate-pulse rounded bg-muted' />
            <div className='h-3 w-36 animate-pulse rounded bg-muted' />
          </div>
        </div>
        <div className='mt-6 flex flex-col gap-2'>
          <div className='h-4 w-16 animate-pulse rounded bg-muted' />
          <div className='h-3 w-full animate-pulse rounded bg-muted' />
          <div className='h-3 w-full animate-pulse rounded bg-muted' />
          <div className='h-3 w-3/4 animate-pulse rounded bg-muted' />
        </div>
        <div className='mt-4 overflow-hidden rounded-lg'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton
              key={i}
              className='h-9 animate-pulse border-b border-border bg-card last:border-0'
            />
          ))}
        </div>
      </aside>
      <main className='min-w-0 flex-1 space-y-8 px-4 py-4 lg:px-0 lg:py-0'>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton
            key={i}
            className='space-y-3'>
            <div className='h-5 w-24 animate-pulse rounded bg-muted' />
            <div className='flex gap-4'>
              {Array.from({ length: 3 }).map((_, j) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton
                  key={j}
                  className='h-36 w-36 shrink-0 animate-pulse rounded-sm bg-muted'
                />
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
