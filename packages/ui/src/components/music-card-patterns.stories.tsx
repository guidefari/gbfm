import { Artwork } from './artwork'
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
        <article className='group/row flex flex-col sm:flex-row gap-5 border-b border-border/60 pb-6 transition-colors hover:border-highlight/40'>
          <Artwork
            src={mix.imageUrl}
            alt={mix.title}
            fallbackSrc={FALLBACK}
            radius='none'
            border='none'
            className='w-full sm:w-40 md:w-52 shrink-0'
            overlay={
              <>
                <span className='pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/row:opacity-100' />
                <span className='absolute left-3 top-3 bg-highlight px-1.5 py-0.5 text-[10px] font-medium tracking-widest leading-none text-highlight-foreground'>
                  new
                </span>
                <span className='absolute inset-0 flex items-center justify-center transition-opacity duration-200 [@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 focus-within:opacity-100'>
                  <PlayToggle
                    state={playbackStates.idle}
                    variant='hero'
                    label={mix.title}
                    onToggle={() => {}}
                  />
                </span>
              </>
            }
          />

          <div className='flex min-w-0 flex-1 flex-col justify-center gap-3'>
            <div className='space-y-1.5'>
              <p className='text-[11px] tracking-[0.2em] text-muted-foreground'>{mix.eyebrow}</p>
              <h3 className='text-2xl md:text-3xl font-bold leading-[1.1] tracking-tight text-foreground transition-colors group-hover/row:text-highlight'>
                {mix.title}
              </h3>
            </div>

            <p className='max-w-prose text-sm leading-relaxed text-muted-foreground'>
              {mix.description}
            </p>

            <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tracking-widest text-muted-foreground'>
              {mix.tags.map((tag, index) => (
                <span key={tag} className='flex items-center gap-2'>
                  {index > 0 && (
                    <span aria-hidden className='text-border'>
                      /
                    </span>
                  )}
                  <span className='transition-colors hover:text-highlight'>{tag}</span>
                </span>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className='space-y-3'>
        <h2 className='text-sm tracking-[0.2em] text-muted-foreground'>Show card grid</h2>
        <div className='grid gap-x-4 gap-y-6 grid-cols-2 md:grid-cols-4'>
          {[0, 1, 2, 3].map((index) => {
            const example = mediaExamples[index % 2]
            return (
              <article key={index} className='group/card flex flex-col gap-3'>
                <Artwork
                  src={index === 2 ? null : example.imageUrl}
                  alt={example.title}
                  fallbackSrc={FALLBACK}
                  radius='none'
                  border='none'
                  className='w-full'
                  overlay={
                    <>
                      <span className='pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent' />
                      <span
                        aria-hidden
                        className='pointer-events-none absolute -bottom-3 -left-1 text-7xl font-black italic leading-none tracking-tighter text-foreground/85 mix-blend-overlay transition-transform duration-300 group-hover/card:-translate-y-1'>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className='absolute right-1.5 top-1.5 transition-opacity duration-200 [@media(hover:hover)]:opacity-0 group-hover/card:opacity-100 focus-within:opacity-100'>
                        <PlayToggle
                          state={playbackStates.idle}
                          variant='icon'
                          label={example.title}
                          onToggle={() => {}}
                          className='bg-background/70 p-1.5 text-foreground hover:text-highlight'
                        />
                      </span>
                    </>
                  }
                />
                <div className='space-y-1'>
                  <p className='text-[10px] tracking-[0.2em] text-muted-foreground'>
                    {example.eyebrow}
                  </p>
                  <h3 className='text-sm font-semibold leading-snug text-foreground transition-colors group-hover/card:text-highlight line-clamp-2'>
                    {example.title}
                  </h3>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className='space-y-3'>
        <h2 className='text-sm tracking-[0.2em] text-muted-foreground'>Show list row</h2>
        <div className='max-w-2xl'>
          {mediaExamples.map((example, index) => (
            <article
              key={example.title}
              className='group/item relative flex items-center gap-4 border-b border-border/50 py-3 pl-3 transition-colors hover:border-highlight/40 hover:bg-foreground/[0.03]'>
              <span className='absolute inset-y-0 left-0 w-px bg-highlight opacity-0 transition-opacity group-hover/item:opacity-100' />

              <span className='w-7 shrink-0 text-lg font-bold italic tabular-nums leading-none text-muted-foreground/40 transition-colors group-hover/item:text-highlight'>
                {String(index + 1).padStart(2, '0')}
              </span>

              <Artwork
                src={example.imageUrl}
                alt={example.title}
                fallbackSrc={FALLBACK}
                radius='none'
                border='none'
                className='w-14 shrink-0'
                overlay={
                  <span className='absolute inset-0 flex items-center justify-center bg-background/50 transition-opacity duration-200 [@media(hover:hover)]:opacity-0 group-hover/item:opacity-100 focus-within:opacity-100'>
                    <PlayToggle
                      state={playbackStates.idle}
                      variant='icon'
                      label={example.title}
                      onToggle={() => {}}
                    />
                  </span>
                }
              />

              <div className='min-w-0 flex-1 space-y-0.5'>
                <h3 className='truncate text-sm font-semibold leading-tight text-foreground transition-colors group-hover/item:text-highlight'>
                  {example.title}
                </h3>
                <p className='truncate text-xs leading-relaxed text-muted-foreground'>
                  {example.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
