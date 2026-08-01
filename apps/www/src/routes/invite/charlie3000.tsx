import { Button } from '@gbfm/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Headphones, LayoutGrid, Mic2 } from 'lucide-react'
import { generateSEOMeta, generateStaticPageSEO } from '@/lib/seo'

const pageSEO = generateStaticPageSEO(
  'An invite for Charlie3000',
  'A personal invitation to Charlie3000 to record a guest mix for goosebumps.fm',
  '/invite/charlie3000'
)

const featureCards = [
  {
    icon: Headphones,
    title: 'Built for listening',
    body: 'The site centers mixes and long-form playback, with a proper page per set.',
    rotation: '-rotate-1'
  },
  {
    icon: LayoutGrid,
    title: 'A place to explore',
    body: 'Listeners can move from your mix into the rest of your catalogue, and if you want bespoke functionality around your mixes, we can build it.',
    rotation: 'rotate-1'
  }
] as const

type Fact = {
  label: string
  value: string
  to?: string
}

const facts: Fact[] = [
  { label: 'Stipend', value: '€100 per mix' },
  { label: 'Format', value: 'Guest mix on the main show', to: '/shows/gbfm' },
  { label: 'Cadence', value: 'Start with one, open to more' }
]

export const Route = createFileRoute('/invite/charlie3000')({
  component: InviteCharliePage,
  head: () => ({
    meta: generateSEOMeta(pageSEO)
  })
})

function InviteCharliePage() {
  return (
    <div className='relative overflow-hidden'>
      <div className='pointer-events-none absolute -top-20 -left-24 w-88 h-88 rounded-full bg-gb-pastel-green-2/10 blur-3xl' />
      <div className='pointer-events-none absolute top-[40%] -right-32 w-104 h-104 rounded-full bg-gb-highlight/10 blur-3xl' />

      <div className='relative px-4 py-10 mx-auto max-w-6xl sm:px-6 lg:px-8 lg:py-16'>
        <div className='grid gap-10 lg:gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)] lg:items-start'>
          <section className='space-y-10'>
            <div className='space-y-5'>
              <h1 className='text-4xl mt-0 font-black tracking-tighter sm:text-5xl lg:text-6xl xl:text-7xl'>
                hi Charlie!{' '}
                <span className='relative inline-block'>
                  <span className='relative z-10'>I'd love</span>
                  <span className='absolute inset-x-0 bottom-1 h-3 bg-gb-highlight/40 z-0' />
                </span>{' '}
                to host a guest mix from you
              </h1>

              <p className='max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl'>
                Over the past year and a bit, your Rinse FM residency has become a refuge for me. I
                reach for any mix whenever I don't want to think about music, and I've discovered so
                many tracks through your show that I ended up adoring. I'd love to host and archive
                some of that magic here, starting with one mix, and happy to keep going if it
                clicks.
              </p>
            </div>

            <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap'>
              <Button asChild variant='default' size='lg' className='rounded-none'>
                <Link to='/$slug' params={{ slug: 'kimetsu' }}>
                  See kimetsu.'s page
                  <ArrowRight className='w-4 h-4 ml-2' />
                </Link>
              </Button>
              <Button asChild variant='secondary' size='lg' className='rounded-none'>
                <Link to='/djs'>Meet the residents</Link>
              </Button>
            </div>

            <blockquote className='text-xl ml-0 font-medium text-foreground leading-snug'>
              Your mix gets a proper page, archived with care upload.
            </blockquote>

            <div className='relative grid gap-5 sm:grid-cols-2'>
              {featureCards.map((card) => (
                <article
                  key={card.title}
                  className={`p-5 border border-border/60 bg-muted/30 backdrop-blur-sm transition-transform duration-200 hover:rotate-0 hover:-translate-y-1 ${card.rotation}`}>
                  <card.icon className='w-5 h-5 mb-3 text-gb-highlight' />
                  <h2 className='text-base font-bold'>{card.title}</h2>
                  <p className='mt-2 text-base leading-relaxed text-muted-foreground'>
                    {card.body}
                  </p>
                </article>
              ))}
            </div>

            <div className='space-y-4'>
              <h2 className='text-2xl font-black tracking-tight flex items-center gap-3'>
                <span className='h-px flex-none w-8 bg-gb-highlight' />
                What this looks like in practice
              </h2>
              <div className='space-y-3 text-muted-foreground'>
                <p>
                  We already host{' '}
                  <Link
                    to='/$slug'
                    params={{ slug: 'kimetsu' }}
                    className='underline underline-offset-4 text-gb-pastel-green-1 hover:text-gb-highlight'>
                    kimetsu.
                  </Link>{' '}
                  as a resident, his profile is the shape of thing I'd want to build around your
                  mixes too.
                </p>
                <p>
                  So far, I've been able to budget €100 per mix. The request is one mix to start,
                  and if we both enjoy it, I'd love to make this an ongoing thing.
                </p>
              </div>
            </div>
          </section>

          <aside className='lg:sticky lg:top-6 lg:self-start space-y-4'>
            <div className='relative'>
              <div className='absolute -top-3 left-6 z-10 inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold tracking-[0.25em] border border-gb-pastel-green-2/50 bg-gb-darker-bg text-gb-pastel-green-1 rotate-[-1.5deg]'>
                <Mic2 className='w-3.5 h-3.5' />
                An invitation
              </div>
              <div className='p-6 pt-8 border-2 border-gb-pastel-green-2/40 bg-gb-darker-bg/60 backdrop-blur-sm rotate-[0.5deg]'>
                <p className='text-2xl font-black tracking-tight text-foreground'>
                  A guest mix, with room for more
                </p>

                <dl className='grid grid-cols-1 gap-3 mt-6'>
                  {facts.map((fact) => (
                    <div key={fact.label} className='p-3 border border-border/50 bg-background/70'>
                      <dt className='text-[10px] font-semibold tracking-[0.2em] text-muted-foreground'>
                        {fact.label}
                      </dt>
                      <dd className='mt-1 text-base font-medium'>
                        {fact.to ? (
                          <Link
                            to={fact.to}
                            className='underline underline-offset-4 text-gb-pastel-green-1 hover:text-gb-highlight'>
                            {fact.value}
                          </Link>
                        ) : (
                          fact.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
