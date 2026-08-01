import CustomLink from './custom-link'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Content/Custom link'
}

export function CustomLinks() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Navigation'
        title='CustomLink'
        description='Thin anchor wrapper with passthrough className and target support.'
      />
      <div className='space-y-4'>
        <CustomLink href='#' className='text-blue-500 underline'>
          Internal link
        </CustomLink>
        <br />
        <CustomLink
          href='https://example.com'
          target='_blank'
          rel='noreferrer'
          className='text-green-500 underline'>
          External link (new tab)
        </CustomLink>
        <br />
        <CustomLink href='#' className='text-base text-muted-foreground'>
          Muted link
        </CustomLink>
      </div>
    </div>
  )
}
