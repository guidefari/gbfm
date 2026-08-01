import { PageTitle } from './page-title'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Content/Page title'
}

export function PageTitles() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Layout'
        title='PageTitle'
        description='Top-of-page heading with optional description.'
      />
      <div className='space-y-8 border border-border'>
        <PageTitle title='Mixes' />
        <PageTitle title='Artists' description='Browse all artists in the catalog.' />
        <PageTitle
          title='Admin Dashboard'
          description={
            <span>
              Manage <strong>content</strong>, users, and settings.
            </span>
          }
        />
      </div>
    </div>
  )
}
