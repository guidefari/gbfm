import { createFileRoute, Link } from '@tanstack/react-router'
import { ProfileContentGrid } from '@/components/profile/ProfileContentGrid'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { type PublicProfile, usePublicProfile, VPS_BASE_URL } from '@/lib/http'
import { generateProfileSEO, generateSEOMeta } from '@/lib/seo'

export const Route = createFileRoute('/profile/$username')({
  component: ProfilePage,
  loader: async ({ params }) => {
    try {
      const response = await fetch(
        `${VPS_BASE_URL}/profile/${params.username}`,
        { credentials: 'include' }
      )
      if (!response.ok) return { profile: null }
      const profile: PublicProfile = await response.json()
      if (!profile?.id) return { profile: null }
      return { profile }
    } catch {
      return { profile: null }
    }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.profile) {
      return {
        meta: [
          { title: 'Profile not found | goosebumps.fm' },
          {
            name: 'description',
            content: 'This profile does not exist on goosebumps.fm'
          }
        ]
      }
    }

    const seoData = generateProfileSEO(loaderData.profile, params.username)
    return { meta: generateSEOMeta(seoData) }
  }
})

function ProfileNotFound({ username }: { username: string }) {
  return (
    <div className='mx-auto max-w-md px-4 py-16 text-center'>
      <h1 className='text-3xl font-bold text-foreground'>Account not found</h1>
      <p className='mt-3 text-muted-foreground'>
        The account{' '}
        <span className='font-medium text-foreground'>@{username}</span> doesn't
        exist.
      </p>
      <div className='mt-6 flex justify-center gap-3'>
        <Link
          to='/'
          className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90'>
          Go home
        </Link>
        <Link
          to='/mixes'
          className='rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted'>
          Browse mixes
        </Link>
      </div>
    </div>
  )
}

function ProfilePage() {
  const { username } = Route.useParams()
  const { profile: loaderProfile } = Route.useLoaderData()
  const { data, error, isPending } = usePublicProfile(username)

  const profile = data ?? loaderProfile

  if (isPending && !profile) {
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
          {Array.from({ length: 4 }).map((_, _i) => (
            <div
              key={crypto.randomUUID()}
              className='aspect-square animate-pulse rounded-md bg-muted'
            />
          ))}
        </div>
      </div>
    )
  }

  if (!profile || error) {
    return <ProfileNotFound username={username} />
  }

  return (
    <div className='mx-auto max-w-6xl px-4 py-6'>
      <ProfileHeader profile={profile} />
      <div className='mt-8'>
        <ProfileContentGrid content={profile.content} />
      </div>
    </div>
  )
}
