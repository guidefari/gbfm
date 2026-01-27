import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import type { PublicProfile } from '@/lib/http'

interface ProfileHeaderProps {
  profile: PublicProfile
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className='flex flex-col items-center gap-4 sm:flex-row sm:items-start'>
      <div className='h-24 w-24 overflow-hidden rounded-full border border-border bg-muted'>
        <img
          src={profile.image || DEFAULT_IMAGE_URL}
          alt={`${profile.name}'s avatar`}
          className='h-full w-full object-cover'
        />
      </div>
      <div className='text-center sm:text-left'>
        <h1 className='text-2xl font-bold text-foreground'>{profile.name}</h1>
        {profile.username && (
          <p className='text-sm text-muted-foreground'>@{profile.username}</p>
        )}
        <p className='text-sm text-muted-foreground'>
          Member since {memberSince}
        </p>
      </div>
    </div>
  )
}
