import { Link } from '@tanstack/react-router'
import { Music, Share2, User } from 'lucide-react'
import { FavoriteButton } from '@/components/FavoriteButton'
import { MDXRendrr } from '@/components/MDXRendrr'
import { EpisodeGrid } from '@/components/shows/EpisodeGrid'

export type ShowLandingPageProps = {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnailUrl: string | null
  bannerImageUrl: string | null
  tags: string[] | null
  compiledContent: string | null
  hosts: Array<{ id: string; name: string; username: string | null }>
}

export function ShowLandingPage({ show }: { show: ShowLandingPageProps }) {
  const tags = show.tags || []
  const bannerUrl = show.bannerImageUrl || show.thumbnailUrl || '/fav.png'
  const logoUrl = show.thumbnailUrl || '/fav.png'

  return (
    <div className='min-h-screen bg-background text-foreground selection:bg-highlight/30 overflow-x-hidden'>
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
              </div>
            </div>

            <div className='flex gap-3'>
              <FavoriteButton
                contentType='show'
                contentId={show.id}
                contentTitle={show.title}
                size='lg'
              />
              <button
                type='button'
                className='p-3 transition-colors border text-foreground border-border bg-muted/50 hover:bg-muted hover:text-highlight'>
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className='grid max-w-6xl grid-cols-1 gap-16 px-4 py-12 mx-auto md:px-12 lg:grid-cols-3 overflow-hidden'>
        <div className='space-y-12 lg:col-span-2 min-w-0'>
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
      </main>
    </div>
  )
}
