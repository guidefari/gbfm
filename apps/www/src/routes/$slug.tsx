import { createFileRoute, Link } from '@tanstack/react-router'
import { Music, Share2, User } from 'lucide-react'
import { MDXRendrr } from '@/components/MDXRendrr'
import { ProfileContentGrid } from '@/components/profile/ProfileContentGrid'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { EpisodeGrid } from '@/components/shows/EpisodeGrid'
import { SubscribeButton } from '@/components/shows/SubscribeButton'
import { type ResolveResult, useResolveSlug, VPS_BASE_URL } from '@/lib/http'
import {
  generateProfileSEO,
  generateResolvedShowSEO,
  generateSEOMeta
} from '@/lib/seo'

export const Route = createFileRoute('/$slug')({
  component: SlugPage,
  loader: async ({ params }) => {
    try {
      const response = await fetch(`${VPS_BASE_URL}/resolve/${params.slug}`, {
        credentials: 'include'
      })
      if (!response.ok) return { resolved: null }
      const resolved: ResolveResult = await response.json()
      return { resolved }
    } catch {
      return { resolved: null }
    }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.resolved) {
      return {
        meta: [
          { title: 'Not found | goosebumps.fm' },
          {
            name: 'description',
            content: 'This page does not exist on goosebumps.fm'
          }
        ]
      }
    }

    if (loaderData.resolved.type === 'profile') {
      const seoData = generateProfileSEO(loaderData.resolved.data, params.slug)
      return { meta: generateSEOMeta(seoData) }
    }

    const seoData = generateResolvedShowSEO(
      loaderData.resolved.data,
      params.slug
    )
    return { meta: generateSEOMeta(seoData) }
  }
})

function NotFound({ slug }: { slug: string }) {
  return (
    <div className='max-w-md px-4 py-16 mx-auto text-center'>
      <h1 className='text-3xl font-bold text-foreground'>Not found</h1>
      <p className='mt-3 text-muted-foreground'>
        <span className='font-medium text-foreground'>@{slug}</span> doesn't
        exist.
      </p>
      <div className='flex justify-center gap-3 mt-6'>
        <Link
          to='/'
          className='px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90'>
          Go home
        </Link>
        <Link
          to='/mixes'
          className='px-4 py-2 text-sm font-medium border rounded-md border-border text-foreground hover:bg-muted'>
          Browse mixes
        </Link>
      </div>
    </div>
  )
}

function ProfileView({
  profile
}: {
  profile: NonNullable<Extract<ResolveResult, { type: 'profile' }>>['data']
}) {
  return (
    <div className='max-w-6xl px-4 py-6 mx-auto'>
      <ProfileHeader profile={profile} />
      <div className='mt-8'>
        <ProfileContentGrid content={profile.content} />
      </div>
    </div>
  )
}

function ShowView({
  show
}: {
  show: NonNullable<Extract<ResolveResult, { type: 'show' }>>['data']
}) {
  const tags = show.tags || []
  const bannerUrl = show.bannerImageUrl || show.thumbnailUrl || '/fav.png'
  const logoUrl = show.thumbnailUrl || '/fav.png'

  return (
    <div className='min-h-screen bg-background text-foreground selection:bg-highlight/30'>
      <div className='relative h-[40vh] md:h-[50vh] overflow-hidden'>
        <img
          src={bannerUrl}
          className='w-full h-full object-cover opacity-40 scale-105 blur-[2px]'
          alt='Banner'
        />
        <div className='absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent' />

        <div className='absolute bottom-0 left-0 w-full p-6 md:p-12'>
          <div className='flex flex-col items-end max-w-6xl gap-8 mx-auto md:flex-row'>
            <div className='relative hidden group shrink-0 md:block'>
              <img
                src={logoUrl}
                className='w-48 h-48 transition-transform duration-500 border shadow-2xl border-border group-hover:scale-105'
                alt='Logo'
              />
              <div className='absolute inset-0 transition-colors bg-black/20 group-hover:bg-transparent' />
            </div>

            <div className='flex-1 space-y-4'>
              <div className='flex flex-wrap gap-2'>
                {tags.map((tag: string) => (
                  <span
                    key={tag}
                    className='px-2 py-1 bg-muted/50 hover:bg-muted transition-colors backdrop-blur-md text-[10px] uppercase tracking-widest text-muted-foreground'>
                    {tag}
                  </span>
                ))}
              </div>
              <h1 className='text-5xl font-bold tracking-tighter uppercase md:text-7xl text-gb-pastel-green-1'>
                {show.title}
              </h1>
              <div className='flex items-center gap-6 text-sm text-muted-foreground'>
                {show.hosts && show.hosts.length > 0 && (
                  <span className='flex items-center gap-2'>
                    <User size={16} className='text-highlight' />
                    Hosted by{' '}
                    {show.hosts.map((host, index) => {
                      const isLink = !!host.username
                      const content = isLink ? (
                        <Link
                          to='/$slug'
                          params={{ slug: host.username || '' }}
                          className='cursor-pointer text-foreground hover:text-highlight hover:underline'>
                          {host.name}
                        </Link>
                      ) : (
                        <span className='text-foreground'>{host.name}</span>
                      )

                      return (
                        <span key={host.id}>
                          {content}
                          {index < show.hosts.length - 1 && ', '}
                        </span>
                      )
                    })}
                  </span>
                )}
                {/* <span className='flex items-center gap-2'>
                  <Calendar size={16} /> Monthly
                </span> */}
              </div>
            </div>

            <div className='flex gap-3'>
              <SubscribeButton showId={show.id} showTitle={show.title} />
              <button
                type='button'
                className='p-3 transition-colors border text-foreground border-border bg-muted/50 hover:bg-muted hover:text-highlight'>
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className='grid max-w-6xl grid-cols-1 gap-16 px-6 py-12 mx-auto md:px-12 lg:grid-cols-3'>
        <div className='space-y-12 lg:col-span-2'>
          <section>
            <div className='flex items-center justify-between pb-4 mb-8 border-b border-border'>
              <h2 className='flex items-center gap-3 text-2xl font-semibold text-gb-pastel-green-2'>
                <Music className='text-highlight' />
                Latest Broadcasts
              </h2>
            </div>
            <EpisodeGrid showSlug={show.slug} />
          </section>

          {show.compiledContent && (
            <section className='p-8 border bg-muted/20 border-border'>
              <h2 className='mb-6 text-xl italic font-semibold text-gb-pastel-green-2'>
                Curatorial Intent
              </h2>
              <div className='text-lg font-light leading-relaxed prose prose-invert max-w-none text-foreground'>
                <MDXRendrr mdxString={show.compiledContent} />
              </div>
            </section>
          )}
        </div>

        {/* <div className='space-y-10'>
          <div className='sticky space-y-10 top-12'>
            <div className='p-6 border bg-gradient-to-br from-gb-pastel-green-2/20 to-muted/20 border-gb-pastel-green-2/30'>
              <h3 className='text-xs uppercase tracking-[0.2em] text-highlight font-bold mb-4'>
                Featured Broadcast
              </h3>
              <p className='mb-6 text-sm text-muted-foreground'>
                Tune into a hand selected broadcast by {show.hosts?.[0]?.name}.
              </p>
              <button
                type='button'
                className='flex items-center justify-center w-full gap-2 py-3 font-bold transition-all bg-gb-pastel-green-2 text-background hover:bg-highlight'>
                <Play size={18} fill='currentColor' /> Listen Now
              </button>
            </div>

            <div className='space-y-6'>
              <h3 className='pb-2 text-sm font-semibold tracking-widest uppercase border-b text-foreground border-border'>
                Platform
              </h3>
              <Link to='/' className='flex items-center gap-4 no-underline cursor-pointer group'>
                <div className='flex items-center justify-center w-10 h-10 font-serif text-xl text-foreground bg-muted'>
                  g.
                </div>
                <div>
                  <p className='text-sm font-bold text-foreground group-hover:text-highlight'>goosebumps.fm</p>
                  <p className='text-xs underline text-muted-foreground'>
                    Explore home
                  </p>
                </div>
              </Link>
            </div>

            <div className='space-y-4'>
              <h3 className='pb-2 text-sm font-semibold tracking-widest uppercase border-b text-foreground border-border'>
                Network
              </h3>
              <div className='flex flex-wrap gap-2'>
                {tags.length > 0 ? (
                  tags.map((tag: string) => (
                    <span
                      key={tag}
                      className='text-xs px-3 py-1.5 border border-border text-muted-foreground hover:border-highlight hover:text-highlight transition-colors cursor-default'>
                      {tag}
                    </span>
                  ))
                ) : (
                  ['South Africa', 'Archive'].map((item) => (
                    <span
                      key={item}
                      className='text-xs px-3 py-1.5 border border-border text-muted-foreground hover:border-highlight hover:text-highlight transition-colors cursor-default'>
                      {item}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div> */}
      </main>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className='max-w-6xl px-4 py-6 mx-auto'>
      <div className='flex flex-col items-center gap-4 sm:flex-row sm:items-start'>
        <div className='w-24 h-24 rounded-full animate-pulse bg-muted' />
        <div className='space-y-2'>
          <div className='w-32 h-6 rounded animate-pulse bg-muted' />
          <div className='w-24 h-4 rounded animate-pulse bg-muted' />
        </div>
      </div>
    </div>
  )
}

function SlugPage() {
  const { slug } = Route.useParams()
  const { resolved: loaderResolved } = Route.useLoaderData()
  const { data, error, isPending } = useResolveSlug(slug)

  const resolved = data ?? loaderResolved

  if (isPending && !resolved) {
    return <LoadingSkeleton />
  }

  if (!resolved || error) {
    return <NotFound slug={slug} />
  }

  if (resolved.type === 'profile') {
    return <ProfileView profile={resolved.data} />
  }

  return <ShowView show={resolved.data} />
}
