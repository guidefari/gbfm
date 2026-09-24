import { createPageComponent } from '@/components/PageApp'
import { useNavigate } from '@/lib/navigation'
import { createFileRoute } from '@/lib/page'
import { Effect } from 'effect'
import { RouteError } from '@/components/RouteError'
import { ShowsBrowser } from '@/components/shows/ShowsBrowser'
import { ShowsPageLayout } from '@/components/shows/ShowsPageLayout'
import { getApiClient } from '@/lib/api-client'
import { nullOnNotFound } from '@/lib/http-errors'
import { generateSEOHead, generateShowSEO, notFoundHead } from '@/lib/seo'
import { captureException } from '@/services/analytics'

export const Route = createFileRoute('/shows/$showSlug')({
  component: ShowPage,
  errorComponent: ({ error }) => <RouteError error={error} />,
  loader: async ({ params }) => {
    const client = await getApiClient()
    const show = await nullOnNotFound(
      Effect.runPromise(
        client.shows
          .getShowBySlug({ params: { slug: params.showSlug } })
          .pipe(
            Effect.tapError((error) => captureException(error, { endpoint: 'shows.getShowBySlug' }))
          )
      )
    )
    if (show === null) return { show: null }
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
  const navigate = useNavigate()

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

export const Page = createPageComponent(Route)
