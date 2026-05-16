import { ProfilePreviewCard } from './profile-preview-card'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/ProfilePreviewCard'
}

export function ProfilePreviews() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Profile'
        title='ProfilePreviewCard'
        description='Live preview of how a profile will appear to other users.'
      />
      <div className='grid gap-6 max-w-md'>
        <ProfilePreviewCard displayName='Burial' username='burial' />
        <ProfilePreviewCard displayName='Four Tet' username='fourtet' />
        <ProfilePreviewCard displayName='' username='' />
      </div>
    </div>
  )
}
