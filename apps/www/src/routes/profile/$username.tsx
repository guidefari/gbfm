import { createFileRoute, Link } from '@tanstack/react-router'
import { PublicProfilePage } from '@/components/profile/PublicProfilePage'
import { fetcher, type PublicProfile, VPS_BASE_URL } from '@/lib/http'
import { generateProfileSEO, generateSEOMeta } from '@/lib/seo'

export const Route = createFileRoute('/profile/$username')({
  component: ProfilePage,
  loader: async ({ params }) => {
    try {
      const profile = await fetcher<PublicProfile>(`${VPS_BASE_URL}/profile/${params.username}`)
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
        The account <span className='font-medium text-foreground'>@{username}</span> doesn't exist.
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
  const { profile } = Route.useLoaderData()

  if (!profile) {
    return <ProfileNotFound username={username} />
  }

  return <PublicProfilePage profile={profile} />
}
