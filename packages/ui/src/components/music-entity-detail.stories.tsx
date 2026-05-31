import { Button } from './button'
import { MusicEntityArtistsPanel } from './music-entity-artists-panel'
import { MusicEntityDetail } from './music-entity-detail'
import { MusicEntityLinksPanel } from './music-entity-links-panel'
import { MusicEntityMetadataForm } from './music-entity-metadata-form'
import { mockArtists, mockLinks, StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/MusicEntityDetail'
}

export function MusicEntityDetails() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Admin UI'
        title='Music entity detail'
        description='Detail/edit shell for artists, albums, tracks, and playlists.'
      />
      <MusicEntityDetail
        entityType='artist'
        name='Burial'
        imageUrl='https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=80'
        publishedAt={new Date('2023-06-01')}
        createdAt={new Date('2023-01-15')}
        updatedAt={new Date('2024-03-10')}
        createdBy={{ name: 'Guide Fari', email: 'guideg6@gmail.com' }}
        metadataSlot={
          <MusicEntityMetadataForm
            entityType='artist'
            initialData={{
              name: 'Burial',
              bio: 'Anonymous UK producer known for dark, atmospheric dubstep.',
              imageUrl: null,
              genres: ['dubstep', 'ambient', 'electronic'],
              slug: 'burial',
              publishedAt: new Date('2023-06-01')
            }}
            onSubmit={(data) => console.log('save', data)}
          />
        }
        linksSlot={
          <MusicEntityLinksPanel
            links={mockLinks}
            onAdd={(platform, url) => console.log('add', platform, url)}
            onUpdateStatus={(id, status) => console.log('status', id, status)}
            onDelete={(id) => console.log('delete', id)}
          />
        }
        relationshipsSlot={
          <MusicEntityArtistsPanel
            artists={mockArtists}
            onAdd={(id, role) => console.log('add artist', id, role)}
            onRemove={(id) => console.log('remove artist', id)}
          />
        }
        actionsSlot={
          <Button variant='destructive' size='sm'>
            Delete
          </Button>
        }
      />
    </div>
  )
}
