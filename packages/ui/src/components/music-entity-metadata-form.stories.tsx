import { MusicEntityMetadataForm } from './music-entity-metadata-form'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Forms/Music entity metadata'
}

export function AlbumMetadataForm() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Admin UI'
        title='Album metadata form'
        description='Editable metadata fields for music entities.'
      />
      <MusicEntityMetadataForm
        entityType='album'
        initialData={{
          title: 'Untrue',
          artistNames: ['Burial'],
          releaseDate: new Date('2007-11-05'),
          coverImageUrl: null,
          genres: ['dubstep', 'ambient'],
          albumType: 'LP',
          slug: 'untrue',
          publishedAt: new Date('2023-06-01')
        }}
        onSubmit={(data) => console.log('save album', data)}
      />
    </div>
  )
}
