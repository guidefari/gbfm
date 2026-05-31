import { Button } from './button'
import HorizontalScrollCards from './horizontal-scroll-cards'
import { MediaCard } from './media-card'
import { mediaExamples, StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/HorizontalScrollCards'
}

const items = [
  ...mediaExamples,
  ...mediaExamples.map((e) => ({ ...e, title: `${e.title} (2)` })),
  ...mediaExamples.map((e) => ({ ...e, title: `${e.title} (3)` }))
]

export function HorizontalScroll() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Layout'
        title='HorizontalScrollCards'
        description='Horizontally scrollable container. Resize the panel to see scrollbar appear.'
      />
      <HorizontalScrollCards>
        {items.map((item) => (
          <div key={item.title} className='w-64 shrink-0'>
            <MediaCard
              title={item.title}
              eyebrow={item.eyebrow}
              imageUrl={item.imageUrl}
              description={item.description}
              tags={item.tags}
              actions={<Button size='sm'>Play</Button>}
            />
          </div>
        ))}
      </HorizontalScrollCards>
    </div>
  )
}
