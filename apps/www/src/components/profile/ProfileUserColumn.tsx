import { ProfileSocialLinks } from '@/components/profile/ProfileSocialLinks'
// import { ShareButton } from '@/components/ShareButton'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import type { PublicProfile } from '@/lib/http'

interface ProfileUserColumnProps {
  profile: PublicProfile
}

export function ProfileUserColumn({ profile }: ProfileUserColumnProps) {
  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-start gap-4 px-4 pt-4 pb-2 lg:px-8 lg:pt-8 lg:pb-0'>
        <div className='h-24 w-24 shrink-0 overflow-hidden bg-muted'>
          <img
            src={profile.image || DEFAULT_IMAGE_URL}
            alt={`${profile.name}'s avatar`}
            className='h-full w-full object-cover'
          />
        </div>
        <div className='flex min-w-0 flex-1 items-start justify-between gap-2'>
          <div className='flex flex-col gap-1'>
            <h1 className='font-mono text-2xl font-bold my-0 text-highlight'>
              {profile.name}
            </h1>
            {profile.username && (
              <p className='font-mono text-sm text-foreground'>
                @{profile.username}
              </p>
            )}
            <p className='font-mono text-xs text-foreground'>
              Member since {memberSince}
            </p>
          </div>
          {/* {profile.username && (
            <ShareButton type='profile' slug={profile.username} />
          )} */}
        </div>
      </div>

      <div className='flex flex-col gap-3 px-4 pb-4 lg:px-8 lg:pb-6'>
        {profile.bio && (
          <div className='flex flex-col'>
            <h2 className='font-mono text-base font-bold text-highlight'>
              About
            </h2>
            <p className='font-mono p-0 text-sm leading-relaxed text-foreground'>
              {profile.bio}
            </p>
          </div>
        )}

        {profile.socialLinks.length > 0 && (
          <ProfileSocialLinks
            username={profile.username}
            socialLinks={profile.socialLinks}
          />
        )}
      </div>
    </div>
  )
}
