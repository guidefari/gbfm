import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { Link } from '@/lib/navigation'
import { Effect } from 'effect'
import { PublicProfilePage } from '@/components/profile/PublicProfilePage'
import { getApiClient } from '@/lib/api-client'
import { nullOnNotFound } from '@/lib/http-errors'
import { generateProfileSEO, generateSEOHead, notFoundHead } from '@/lib/seo'

export const Route = createFileRoute('/profile/$username')({
  component: ProfilePage,
  loader: async ({ params }) => {
    const client = await getApiClient()
    const profile = await nullOnNotFound(
      Effect.runPromise(client.profile.getPublicProfile({ params: { username: params.username } }))
    )
    if (!profile?.id) return { profile: null }
    return { profile }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.profile) {
      return notFoundHead('Profile not found', 'This profile does not exist on goosebumps.fm')
    }
    return generateSEOHead(generateProfileSEO(loaderData.profile, params.username))
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
          className='rounded-md bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:bg-primary/90'>
          Go home
        </Link>
        <Link
          to='/shows'
          className='rounded-md border border-border px-4 py-2 text-base font-medium text-foreground hover:bg-muted'>
          Browse radio shows
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

export const Page = createPageComponent(Route)
