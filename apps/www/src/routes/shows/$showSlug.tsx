import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { useEffect } from 'react'
import { RouteError } from '@/components/RouteError'
import { ShowsBrowser } from '@/components/shows/ShowsBrowser'
import { ShowsPageLayout } from '@/components/shows/ShowsPageLayout'
import { getApiClient } from '@/lib/api-client'
import { generateSEOMeta, generateShowSEO } from '@/lib/seo'
import { captureException } from '@/services/analytics'
import { useSetCurrentContent } from '@/store'

export const Route = createFileRoute('/shows/$showSlug')({
  component: ShowPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
  loader: async ({ params }) => {
    const client = await getApiClient()
    const show = await Effect.runPromise(
      client.shows
        .getShowBySlug({ params: { slug: params.showSlug } })
        .pipe(
          Effect.tapError((error) => captureException(error, { endpoint: 'shows.getShowBySlug' }))
        )
    )
    return {
      show: {
        ...show,
        createdAt: new Date(show.createdAt),
        updatedAt: new Date(show.updatedAt),
        tags: show.tags ? [...show.tags] : null,
        hosts: show.hosts ? [...show.hosts] : undefined
      }
    }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.show) {
      return {
        meta: [
          {
            title: 'Show | goosebumps.fm'
          },
          {
            name: 'description',
            content: 'Explore radio shows on goosebumps.fm'
          }
        ]
      }
    }

    const seoData = generateShowSEO(loaderData.show, params.showSlug)
    return {
      meta: generateSEOMeta(seoData)
    }
  }
})

function ShowPage() {
  const { showSlug } = Route.useParams()
  const { show } = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const setCurrentContent = useSetCurrentContent()

  useEffect(() => {
    if (show?.hosts) {
      const contentInfo = {
        id: showSlug,
        archetype: 'show',
        creatorIds: show.hosts.map((host) => host.id)
      }
      setCurrentContent(contentInfo)
    }

    return () => setCurrentContent(null)
  }, [show, showSlug, setCurrentContent])

  if (!show) return <div className='p-4 text-center'>No data</div>

  return (
    <ShowsPageLayout>
      <ShowsBrowser
        selectedShow={show}
        onSelectShow={(slug) => navigate({ to: '/shows/$showSlug', params: { showSlug: slug } })}
      />
    </ShowsPageLayout>
  )
}
