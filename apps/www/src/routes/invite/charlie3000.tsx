import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Headphones, LayoutGrid, Mic2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { generateSEOMeta, generateStaticPageSEO } from '@/lib/seo'

const pageSEO = generateStaticPageSEO(
  'An invite for Charlie3000',
  'A personal invitation to Charlie3000 to record a guest mix for goosebumps.fm, with a R3000 stipend and a home for the archive.',
  '/invite/charlie3000'
)

const featureCards = [
  {
    icon: Headphones,
    title: 'Built for listening',
    body: 'The site centers mixes and long-form playback, with a proper page per set.'
  },
  {
    icon: LayoutGrid,
    title: 'A place to explore',
    body: 'Listeners can move from your mix into the rest of your catalogue, and if you want bespoke functionality around your mixes, we can build it.'
  }
] as const

type Fact = {
  label: string
  value: string
  to?: string
}

const facts: Fact[] = [
  { label: 'Stipend', value: '€150 per mix' },
  { label: 'Format', value: 'Guest mix on /shows/gbfm', to: '/shows/gbfm' },
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
    <div className='px-4 py-8 mx-auto max-w-6xl sm:px-6 lg:px-8 lg:py-14'>
      <div className='grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]'>
        <section className='space-y-8'>
          <div className='space-y-4'>
            <Badge variant='secondary' className='gap-2 px-3 py-1 rounded-none'>
              <Mic2 className='w-3.5 h-3.5' />
              Invitation
            </Badge>

            <div className='space-y-4'>
              <h1 className='max-w-3xl text-4xl font-black tracking-tighter sm:text-5xl lg:text-7xl'>
                Charlie3000, I'd love to host a guest mix from you
              </h1>

              <p className='max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl'>
                Over the past year and a bit, your Rinse FM residency has become
                a refuge for me. I reach for any mix whenever I don't want to
                think about music, and I've discovered so many tracks through
                your show that I ended up adoring. I'd love to host and archive
                some of that magic here, starting with one mix, and happy to
                keep going if it clicks.
              </p>
            </div>
          </div>

          <div className='flex flex-col gap-3 sm:flex-row'>
            <Button
              asChild
              variant='default'
              size='lg'
              className='rounded-none'>
              <Link to='/$slug' params={{ slug: 'kimetsu' }}>
                See kimetsu.'s page
                <ArrowRight className='w-4 h-4 ml-2' />
              </Link>
            </Button>
            <Button
              asChild
              variant='secondary'
              size='lg'
              className='rounded-none'>
              <Link to='/djs'>Meet the residents</Link>
            </Button>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            {featureCards.map((card) => (
              <article
                key={card.title}
                className='p-5 border rounded-none border-border/60 bg-muted/20'>
                <card.icon className='w-5 h-5 mb-3 text-foreground/70' />
                <h2 className='text-base font-bold'>{card.title}</h2>
                <p className='mt-2 text-sm leading-relaxed text-muted-foreground'>
                  {card.body}
                </p>
              </article>
            ))}
          </div>

          <div className='space-y-4'>
            <h2 className='text-2xl font-black tracking-tight'>
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
                as a resident, his profile is the shape of thing I'd want to
                build around your mixes too.
              </p>
              <p>
                So far, I've been able to budget €150 per mix. The request is
                one mix to start, and if we both enjoy it, I'd love to make this
                an ongoing thing.
              </p>
            </div>
          </div>
        </section>

        <aside className='lg:sticky lg:top-6 lg:self-start'>
          <div className='p-6 border rounded-none border-border/60 bg-muted/20'>
            <h2 className='text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
              The ask
            </h2>
            <p className='mt-3 text-2xl font-black tracking-tight'>
              A guest mix, with room for more
            </p>

            <dl className='grid grid-cols-1 gap-3 mt-6'>
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className='p-3 border border-border/50 bg-background/60'>
                  <dt className='text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
                    {fact.label}
                  </dt>
                  <dd className='mt-1 text-sm font-medium'>
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
        </aside>
      </div>
    </div>
  )
}
