interface PanelHeaderProps {
  eyebrow: string
  title: string
  description: string
}

export const storyPanelClassName = 'mx-auto w-full max-w-6xl space-y-6'

export const mediaExamples = [
  {
    title: 'Late Night Transmissions 04',
    eyebrow: 'Mix',
    imageUrl:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80',
    description:
      'Dubwise pressure, loose percussion, and slow-burning warehouse records.',
    tags: ['dub', 'leftfield', 'club']
  },
  {
    title: 'Signals From The Green Room',
    eyebrow: 'Editorial',
    imageUrl:
      'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80',
    description:
      'Notes on overlooked records, room tone, and the DJs who connect scenes.',
    tags: ['essay', 'records', 'scene report']
  }
]

export const mockLinks = [
  {
    id: 'link-1',
    entityType: 'artist',
    entityId: 'entity-1',
    platform: 'spotify',
    url: 'https://open.spotify.com/artist/example',
    status: 'verified',
    scrapedAt: null,
    verifiedAt: new Date('2024-03-01'),
    verifiedBy: null,
    metadata: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-03-01')
  },
  {
    id: 'link-2',
    entityType: 'artist',
    entityId: 'entity-1',
    platform: 'bandcamp',
    url: 'https://burial.bandcamp.com',
    status: 'pending_review',
    scrapedAt: null,
    verifiedAt: null,
    verifiedBy: null,
    metadata: null,
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-02-15')
  }
]

export const mockArtists = [
  { artistId: 'a-1', artistName: 'Burial', role: 'primary', displayOrder: 0 },
  { artistId: 'a-2', artistName: 'Four Tet', role: 'featured', displayOrder: 1 }
]

export function StoryPanelHeader({
  eyebrow,
  title,
  description
}: PanelHeaderProps) {
  return (
    <header className='max-w-3xl space-y-2'>
      <p className='text-xs uppercase tracking-[0.2em] text-muted-foreground'>
        {eyebrow}
      </p>
      <h1 className='text-3xl font-bold tracking-tight'>{title}</h1>
      <p className='leading-7 text-muted-foreground'>{description}</p>
    </header>
  )
}
