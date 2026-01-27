import { createFileRoute, redirect } from '@tanstack/react-router'
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
      if (!response.ok) {
        throw redirect({ to: '/', search: { notFound: params.username } })
      }
      const profile: PublicProfile = await response.json()
      if (!profile?.id) {
        throw redirect({ to: '/', search: { notFound: params.username } })
      }
      return { profile }
    } catch (e) {
      if (e instanceof Response || (e && typeof e === 'object' && 'to' in e)) throw e
      throw redirect({ to: '/', search: { notFound: params.username } })
    }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.profile) {
      return {
        meta: [
          { title: 'Profile not found | goosebumps.fm' },
          { name: 'description', content: 'This profile does not exist on goosebumps.fm' }
        ]
      }
    }

    const seoData = generateProfileSEO(loaderData.profile, params.username)
    return { meta: generateSEOMeta(seoData) }
  }
})

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
        <div className='mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className='aspect-square animate-pulse rounded-md bg-muted'
            />
          ))}
        </div>
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className='mx-auto max-w-6xl px-4 py-6 text-center'>
        <h1 className='text-2xl font-bold text-foreground'>Profile not found</h1>
        <p className='mt-2 text-muted-foreground'>
          The user @{username} doesn't exist or their profile is unavailable.
        </p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className='mx-auto max-w-6xl px-4 py-6 text-center'>
        <h1 className='text-2xl font-bold text-foreground'>Profile not found</h1>
        <p className='mt-2 text-muted-foreground'>
          The user @{username} doesn't exist or their profile is unavailable.
        </p>
      </div>
    )
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
