import { createFileRoute } from '@tanstack/react-router'
import { Effect } from 'effect'
import { RouteError } from '@/components/RouteError'
import { ShowsBrowser } from '@/components/shows/ShowsBrowser'
import { ShowsPageLayout } from '@/components/shows/ShowsPageLayout'
import { getApiClient } from '@/lib/api-client'
import { generateSEOHead, generateShowSEO, notFoundHead } from '@/lib/seo'
import { captureException } from '@/services/analytics'

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
      return notFoundHead('Show', 'Explore radio shows on goosebumps.fm')
    }
    return generateSEOHead(generateShowSEO(loaderData.show, params.showSlug))
  }
})

function ShowPage() {
  const { show } = Route.useLoaderData()
  const navigate = Route.useNavigate()

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
