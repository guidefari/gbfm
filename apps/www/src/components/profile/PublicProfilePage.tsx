import { ProfileContentGrid } from '@/components/profile/ProfileContentGrid'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import type { PublicProfile } from '@/lib/http'

export function PublicProfilePage({ profile }: { profile: PublicProfile }) {
  return (
    <div className='mx-auto max-w-6xl px-4 py-6'>
      <ProfileHeader profile={profile} />
      <div className='mt-8'>
        <ProfileContentGrid content={profile.content} />
      </div>
    </div>
  )
}

export function PublicProfilePageSkeleton() {
  return (
    <div className='mx-auto max-w-6xl px-4 py-6'>
      <div className='flex flex-col items-center gap-4 sm:flex-row sm:items-start'>
        <div className='h-24 w-24 animate-pulse rounded-full bg-muted' />
        <div className='space-y-2'>
          <div className='h-6 w-32 animate-pulse rounded bg-muted' />
          <div className='h-4 w-24 animate-pulse rounded bg-muted' />
        </div>
      </div>
      <div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton loader - items never reorder
            key={i}
            className='aspect-square animate-pulse rounded-md bg-muted'
          />
        ))}
      </div>
    </div>
  )
}
