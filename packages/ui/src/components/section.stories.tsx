import { Button } from './button'
import { Section } from './section'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Content/Section'
}

export function Sections() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Layout'
        title='Section'
        description='Semantic section wrapper with a styled heading.'
      />
      <Section title='Featured Mixes'>
        <p className='text-muted-foreground'>
          A curated selection of recent uploads from the community.
        </p>
      </Section>
      <Section title='Artists'>
        <div className='flex gap-2'>
          <Button variant='outline'>Burial</Button>
          <Button variant='outline'>Four Tet</Button>
          <Button variant='outline'>Actress</Button>
        </div>
      </Section>
    </div>
  )
}
