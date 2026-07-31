import { Artwork } from './artwork'
import { Badge } from './badge'
import { playbackStates, PlayToggle } from './play-toggle'
import { mediaExamples, StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/New/Music card patterns'
}

const FALLBACK = 'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'
const [mix] = mediaExamples

export function MusicCardPatterns() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Adoption'
        title='Music card patterns'
        description='The www card compositions rebuilt from Artwork and PlayToggle, so the shared primitives can be reviewed against the surfaces that consume them.'
      />

      <section className='space-y-3'>
        <h2 className='text-sm tracking-[0.2em] text-muted-foreground'>Mix list item</h2>
        <article className='group border border-border bg-card p-5 transition-all duration-200 hover:border-foreground/50'>
          <div className='flex flex-col lg:flex-row gap-6'>
            <div className='flex-1 min-w-0'>
              <h3 className='text-2xl font-black leading-tight tracking-tight text-foreground'>
                {mix.title}
              </h3>
              <p className='mt-4 text-sm leading-relaxed text-foreground/50 border-l-2 border-highlight/20 pl-4 py-1 italic'>
                {mix.description}
              </p>
              <div className='flex flex-wrap items-center gap-1.5 mt-4'>
                {mix.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant='secondary'
                    className='rounded-none border border-border bg-muted/50 text-foreground/70 text-[10px] tracking-widest px-2 py-0.5'>
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className='mt-5 pt-4 border-t border-border/50 flex items-center gap-5'>
                <PlayToggle
                  state={playbackStates.idle}
                  variant='button'
                  label='Late'
                  onToggle={() => {}}
                />
              </div>
            </div>
            <Artwork
              src={mix.imageUrl}
              alt={mix.title}
              fallbackSrc={FALLBACK}
              aspect='auto'
              radius='none'
              className='shrink-0 order-first lg:order-last w-full lg:w-48 h-48'
              overlay={
                <span className='absolute right-2 top-2 border border-highlight bg-highlight px-2 py-1 text-[10px] font-bold tracking-widest leading-none text-highlight-foreground'>
                  new
                </span>
              }
            />
          </div>
        </article>
      </section>

      <section className='space-y-3'>
        <h2 className='text-sm tracking-[0.2em] text-muted-foreground'>Show card grid</h2>
        <div className='grid gap-4 grid-cols-2 md:grid-cols-4'>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className='group flex flex-col gap-2'>
              <Artwork
                src={index === 2 ? null : mediaExamples[index % 2].imageUrl}
                alt='Show artwork'
                fallbackSrc={FALLBACK}
                hover='fade'
                className='w-full shadow-sm'
              />
              <span className='text-sm font-semibold leading-tight text-foreground group-hover:text-highlight line-clamp-2'>
                {mediaExamples[index % 2].title}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className='space-y-3'>
        <h2 className='text-sm tracking-[0.2em] text-muted-foreground'>Show list row</h2>
        <div className='max-w-md space-y-2'>
          {mediaExamples.map((example) => (
            <button
              key={example.title}
              type='button'
              className='w-full flex items-center gap-3 p-2 rounded-sm border border-transparent text-left transition-all hover:bg-muted/40 hover:border-border/60'>
              <Artwork
                src={example.imageUrl}
                alt={example.title}
                fallbackSrc={FALLBACK}
                className='w-16 shrink-0'
              />
              <div className='min-w-0'>
                <p className='text-sm font-semibold text-foreground line-clamp-2'>
                  {example.title}
                </p>
                <p className='text-xs text-muted-foreground line-clamp-1'>{example.eyebrow}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
