import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  MediaCard,
  Skeleton
} from '@gbfm/ui'
import { useEffect, useState } from 'react'

const themes = ['light', 'dark', 'studio'] as const

type Theme = (typeof themes)[number]

const mediaExamples = [
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

function App() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <main
      data-theme={theme}
      className='min-h-screen bg-background text-foreground'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10'>
        <header className='flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between'>
          <div className='max-w-2xl space-y-4'>
            <Badge variant='outline'>@gbfm/ui</Badge>
            <div className='space-y-3'>
              <h1 className='text-4xl font-bold tracking-tight md:text-6xl'>
                GBFM UI Playground
              </h1>
              <p className='text-lg leading-8 text-muted-foreground'>
                A local design-system workspace for primitives, tokens, and
                music-first product patterns.
              </p>
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            {themes.map((themeName) => (
              <Button
                key={themeName}
                type='button'
                variant={theme === themeName ? 'default' : 'outline'}
                onClick={() => setTheme(themeName)}>
                {themeName}
              </Button>
            ))}
          </div>
        </header>

        <GallerySection
          title='Buttons'
          description='Core actions across themes and variants.'>
          <div className='flex flex-wrap gap-3'>
            <Button>Default</Button>
            <Button variant='secondary'>Secondary</Button>
            <Button variant='outline'>Outline</Button>
            <Button variant='ghost'>Ghost</Button>
            <Button variant='link'>Link</Button>
            <Button variant='destructive'>Destructive</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className='flex flex-wrap items-center gap-3'>
            <Button size='sm'>Small</Button>
            <Button>Default</Button>
            <Button size='lg'>Large</Button>
            <Button size='icon' aria-label='Play'>
              ▶
            </Button>
          </div>
        </GallerySection>

        <GallerySection
          title='Cards and Form Primitives'
          description='Basic composition surfaces for app flows.'>
          <div className='grid gap-4 md:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle>Upload details</CardTitle>
                <CardDescription>
                  Primitive card, text, and input styling in one place.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <Input placeholder='Artist, show, or label name' />
                <div className='flex flex-wrap gap-2'>
                  <Badge>Published</Badge>
                  <Badge variant='secondary'>Draft</Badge>
                  <Badge variant='outline'>Archived</Badge>
                  <Badge variant='destructive'>Failed</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Loading state</CardTitle>
                <CardDescription>
                  Skeleton rhythm for media-heavy views.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <Skeleton className='h-40 w-full' />
                <Skeleton className='h-4 w-3/4' />
                <Skeleton className='h-4 w-1/2' />
              </CardContent>
            </Card>
          </div>
        </GallerySection>

        <GallerySection
          title='MediaCard'
          description='First GBFM product seed, presentational by design.'>
          <div className='grid gap-6 md:grid-cols-2'>
            {mediaExamples.map((example) => (
              <MediaCard
                key={example.title}
                title={example.title}
                eyebrow={example.eyebrow}
                imageUrl={example.imageUrl}
                description={example.description}
                tags={example.tags}
                actions={
                  <>
                    <Button size='sm'>Play</Button>
                    <Button size='sm' variant='outline'>
                      Save
                    </Button>
                  </>
                }
                footer='App-specific playback, sharing, and persistence stay outside @gbfm/ui.'
              />
            ))}
          </div>
        </GallerySection>
      </div>
    </main>
  )
}

interface GallerySectionProps {
  title: string
  description: string
  children: React.ReactNode
}

function GallerySection({ title, description, children }: GallerySectionProps) {
  return (
    <section className='space-y-5'>
      <div className='space-y-2'>
        <h2 className='text-2xl font-semibold tracking-tight'>{title}</h2>
        <p className='text-muted-foreground'>{description}</p>
      </div>
      <div className='space-y-4 rounded-sm border border-border bg-card/50 p-5'>
        {children}
      </div>
    </section>
  )
}

export { App }
