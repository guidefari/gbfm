import { Artwork as ArtworkComponent } from './artwork'
import { mediaExamples, StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/New/Artwork'
}

const FALLBACK = 'https://d20tmfka7s58bt.cloudfront.net/gb-default.png'
const [primary] = mediaExamples

export function Artwork() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Primitive'
        title='Artwork'
        description='One artwork block for every music surface. Handles the fallback image, aspect, radius, border, and hover treatment that were previously re-implemented per card.'
      />

      <section className='space-y-3'>
        <h2 className='text-sm tracking-[0.2em] text-muted-foreground'>Radius</h2>
        <div className='grid w-full max-w-3xl gap-4 grid-cols-3'>
          {(['none', 'sm', 'md'] as const).map((radius) => (
            <div key={radius} className='space-y-2'>
              <ArtworkComponent
                src={primary.imageUrl}
                alt={primary.title}
                fallbackSrc={FALLBACK}
                radius={radius}
              />
              <p className='text-xs text-muted-foreground'>radius={radius}</p>
            </div>
          ))}
        </div>
      </section>

      <section className='space-y-3'>
        <h2 className='text-sm tracking-[0.2em] text-muted-foreground'>Hover treatment</h2>
        <div className='grid w-full max-w-4xl gap-4 grid-cols-4'>
          {(['none', 'fade', 'zoom', 'ring'] as const).map((hover) => (
            <div key={hover} className='space-y-2 group'>
              <ArtworkComponent
                src={primary.imageUrl}
                alt={primary.title}
                fallbackSrc={FALLBACK}
                hover={hover}
              />
              <p className='text-xs text-muted-foreground'>hover={hover}</p>
            </div>
          ))}
        </div>
      </section>

      <section className='space-y-3'>
        <h2 className='text-sm tracking-[0.2em] text-muted-foreground'>States</h2>
        <div className='grid w-full max-w-3xl gap-4 grid-cols-3'>
          <div className='space-y-2'>
            <ArtworkComponent
              src={primary.imageUrl}
              alt={primary.title}
              fallbackSrc={FALLBACK}
              isLoading
            />
            <p className='text-xs text-muted-foreground'>isLoading</p>
          </div>
          <div className='space-y-2'>
            <ArtworkComponent src={null} alt='Missing artwork' fallbackSrc={FALLBACK} />
            <p className='text-xs text-muted-foreground'>src=null (fallback)</p>
          </div>
          <div className='space-y-2'>
            <ArtworkComponent
              src={primary.imageUrl}
              alt={primary.title}
              fallbackSrc={FALLBACK}
              overlay={
                <span className='absolute right-2 top-2 border border-highlight bg-highlight px-2 py-1 text-[10px] font-bold tracking-widest leading-none text-highlight-foreground'>
                  new
                </span>
              }
            />
            <p className='text-xs text-muted-foreground'>overlay slot</p>
          </div>
        </div>
      </section>

      <section className='space-y-3'>
        <h2 className='text-sm tracking-[0.2em] text-muted-foreground'>Thumbnail</h2>
        <ArtworkComponent
          src={primary.imageUrl}
          alt={primary.title}
          fallbackSrc={FALLBACK}
          className='w-16 shrink-0'
        />
      </section>
    </div>
  )
}
