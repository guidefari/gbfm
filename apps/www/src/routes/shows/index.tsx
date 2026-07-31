import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { ShowsBrowser } from '@/components/shows/ShowsBrowser'
import { ShowsPageLayout } from '@/components/shows/ShowsPageLayout'
import { useAllShows } from '@/lib/http'
import { generateSEOMeta, STATIC_PAGE_SEO } from '@/lib/seo'

const searchSchema = z.object({
  show: z.string().optional()
})

export const Route = createFileRoute('/shows/')({
  component: ShowsListPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: generateSEOMeta(STATIC_PAGE_SEO.shows)
  })
})

function ShowsListPage() {
  const { show: selectedSlug } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useAllShows()

  useEffect(() => {
    if (data.length > 0 && !selectedSlug) {
      navigate({
        to: '.',
        search: { show: data[0].slug },
        replace: true
      })
    }
  }, [data, selectedSlug, navigate])

  const selectedShow = useMemo(
    () => data.find((show) => show.slug === selectedSlug),
    [data, selectedSlug]
  )

  return (
    <ShowsPageLayout>
      <ShowsBrowser
        selectedShow={selectedShow}
        onSelectShow={(slug) => navigate({ to: '.', search: { show: slug } })}
      />
    </ShowsPageLayout>
  )
}
