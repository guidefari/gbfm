import { ShareButton } from '@/components/ShareButton'
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
          alt={`${profile.displayUsername || profile.username || 'User'}'s avatar`}
          className='h-full w-full object-cover'
        />
      </div>
      <div className='flex-1 text-center sm:text-left'>
        <div className='flex items-start justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-foreground'>
              {profile.displayUsername || profile.username}
            </h1>
            {profile.username && (
              <p className='text-sm text-muted-foreground'>
                @{profile.username}
              </p>
            )}
            <p className='text-sm text-muted-foreground'>
              Member since {memberSince}
            </p>
          </div>
          {profile.username && (
            <ShareButton type='profile' slug={profile.username} />
          )}
        </div>
      </div>
    </div>
  )
}
