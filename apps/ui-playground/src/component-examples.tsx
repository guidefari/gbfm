import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Label,
  MediaCard,
  MusicEntityArtistsPanel,
  MusicEntityDetail,
  MusicEntityLinksPanel,
  MusicEntityMetadataForm,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@gbfm/ui'
import { mediaExamples, type PanelId } from './playground-data'

interface ComponentPreviewProps {
  panel: PanelId
}

function ComponentPreview({ panel }: ComponentPreviewProps) {
  return (
    <div className='min-h-full bg-background p-5 text-foreground'>
      {panel === 'overview' && <OverviewPanel />}
      {panel === 'buttons' && <ButtonsPanel />}
      {panel === 'forms' && <FormsPanel />}
      {panel === 'structure' && <StructurePanel />}
      {panel === 'menus' && <MenusPanel />}
      {panel === 'overlays' && <OverlaysPanel />}
      {panel === 'media-card' && <MediaCardPanel />}
      {panel === 'music-entity' && <MusicEntityPanel />}
    </div>
  )
}

function OverviewPanel() {
  return (
    <div className='space-y-8'>
      <PanelHeader
        eyebrow='System overview'
        title='Tokens, primitives, and product seeds in one review canvas.'
        description='Resize the viewport above to check actual breakpoint behavior inside the iframe.'
      />
      <div className='grid gap-4 md:grid-cols-[1fr_1.4fr]'>
        <FormsPanel compact />
        <MediaCardPanel compact />
      </div>
      <div className='grid gap-4 lg:grid-cols-3'>
        <StructurePanel compact />
        <MenusPanel compact />
        <OverlaysPanel compact />
      </div>
      <ButtonsPanel compact />
    </div>
  )
}

interface CompactPanelProps {
  compact?: boolean
}

function ButtonsPanel({ compact = false }: CompactPanelProps) {
  return (
    <div className='space-y-5'>
      {!compact && (
        <PanelHeader
          eyebrow='Actions'
          title='Buttons'
          description='Primary actions should stay punchy while secondary controls recede.'
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle>Variants</CardTitle>
          <CardDescription>
            Hover, focus, active, and disabled states.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
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
        </CardContent>
      </Card>
    </div>
  )
}

function FormsPanel({ compact = false }: CompactPanelProps) {
  return (
    <div className='space-y-5'>
      {!compact && (
        <PanelHeader
          eyebrow='Forms'
          title='Inputs and form controls'
          description='Labels, text inputs, textareas, checkbox, select, OTP, badges, and loading states.'
        />
      )}
      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Upload details</CardTitle>
            <CardDescription>
              Primitive card, text, and input styling in one place.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='catalog-name'>Catalog name</Label>
              <Input
                id='catalog-name'
                placeholder='Artist, show, or label name'
              />
            </div>
            <Textarea placeholder='Short description' />
            <div className='flex items-center gap-2'>
              <Checkbox id='featured-upload' />
              <Label htmlFor='featured-upload'>Feature this upload</Label>
            </div>
            <Select defaultValue='mix'>
              <SelectTrigger>
                <SelectValue placeholder='Content type' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='mix'>Mix</SelectItem>
                <SelectItem value='release'>Release</SelectItem>
                <SelectItem value='editorial'>Editorial</SelectItem>
              </SelectContent>
            </Select>
            <InputOTP maxLength={6} value='042681'>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
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
    </div>
  )
}

function StructurePanel({ compact = false }: CompactPanelProps) {
  return (
    <div className='space-y-5'>
      {!compact && (
        <PanelHeader
          eyebrow='Structure'
          title='Navigation and contained surfaces'
          description='Tabs, accordions, cards, and scroll areas for dense product screens.'
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle>Tabs and accordion</CardTitle>
          <CardDescription>
            Layout primitives for switching and disclosure.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          <Tabs defaultValue='queue'>
            <TabsList>
              <TabsTrigger value='queue'>Queue</TabsTrigger>
              <TabsTrigger value='history'>History</TabsTrigger>
              <TabsTrigger value='drafts'>Drafts</TabsTrigger>
            </TabsList>
            <TabsContent value='queue'>
              Upcoming reviewed tracks and mixes.
            </TabsContent>
            <TabsContent value='history'>
              Recently published catalog updates.
            </TabsContent>
            <TabsContent value='drafts'>
              Unfinished notes and uploads.
            </TabsContent>
          </Tabs>
          <Accordion type='single' collapsible defaultValue='tokens'>
            <AccordionItem value='tokens'>
              <AccordionTrigger>Theme tokens</AccordionTrigger>
              <AccordionContent>
                Semantic colors should carry each theme without component
                rewrites.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value='viewport'>
              <AccordionTrigger>Viewport review</AccordionTrigger>
              <AccordionContent>
                The iframe preview exercises real media query breakpoints.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <ScrollArea className='h-28 rounded-sm border p-3'>
            <div className='space-y-2 text-sm text-muted-foreground'>
              {[
                'Dub report',
                'Ambient dispatch',
                'Label notes',
                'Club memo',
                'Release scan'
              ].map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

function MenusPanel({ compact = false }: CompactPanelProps) {
  return (
    <div className='space-y-5'>
      {!compact && (
        <PanelHeader
          eyebrow='Menus'
          title='Command and menu primitives'
          description='Action surfaces for editing, sorting, searching, and keyboard-driven flows.'
        />
      )}
      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Dropdown menu</CardTitle>
            <CardDescription>
              Open this inside the preview frame.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline'>Open menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Track actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Play next</DropdownMenuItem>
                <DropdownMenuItem>Add to queue</DropdownMenuItem>
                <DropdownMenuItem>Copy link</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Command</CardTitle>
            <CardDescription>
              Search-style command list surface.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Command className='rounded-sm border'>
              <CommandInput placeholder='Search commands...' />
              <CommandList>
                <CommandEmpty>No command found.</CommandEmpty>
                <CommandGroup heading='Actions'>
                  <CommandItem>Upload mix</CommandItem>
                  <CommandItem>Create label</CommandItem>
                  <CommandItem>Open queue</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function OverlaysPanel({ compact = false }: CompactPanelProps) {
  return (
    <TooltipProvider>
      <ToastProvider>
        <div className='space-y-5'>
          {!compact && (
            <PanelHeader
              eyebrow='Overlays'
              title='Dialog, sheet, tooltip, and toast'
              description='Layered UI primitives for confirmation, detail panels, hints, and feedback.'
            />
          )}
          <Card>
            <CardHeader>
              <CardTitle>Interactive overlays</CardTitle>
              <CardDescription>
                Open controls to inspect portals and focus treatment.
              </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-wrap gap-3'>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant='outline'>Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Publish draft?</DialogTitle>
                    <DialogDescription>
                      This confirms the editorial item is ready for review.
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant='outline'>Sheet</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Queue details</SheetTitle>
                    <SheetDescription>
                      Inspect metadata without leaving the review surface.
                    </SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant='ghost'>Tooltip</Button>
                </TooltipTrigger>
                <TooltipContent>Useful for dense controls.</TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
          <Toast className='max-w-md'>
            <div className='grid gap-1'>
              <ToastTitle>Toast preview</ToastTitle>
              <ToastDescription>
                Static feedback surface for visual review.
              </ToastDescription>
            </div>
          </Toast>
        </div>
      </ToastProvider>
    </TooltipProvider>
  )
}

function MediaCardPanel({ compact = false }: CompactPanelProps) {
  return (
    <div className='space-y-5'>
      {!compact && (
        <PanelHeader
          eyebrow='Product seed'
          title='MediaCard'
          description='A presentational music pattern with app behavior passed in as actions.'
        />
      )}
      <div className='grid gap-5 md:grid-cols-2'>
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
            footer='Playback, sharing, and persistence stay outside @gbfm/ui.'
          />
        ))}
      </div>
    </div>
  )
}

const MOCK_LINKS = [
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

const MOCK_ARTISTS = [
  { artistId: 'a-1', artistName: 'Burial', role: 'primary', displayOrder: 0 },
  { artistId: 'a-2', artistName: 'Four Tet', role: 'featured', displayOrder: 1 }
]

function MusicEntityPanel() {
  return (
    <div className='space-y-8'>
      <PanelHeader
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
            onSubmit={(d) => console.log('save', d)}
          />
        }
        linksSlot={
          <MusicEntityLinksPanel
            links={MOCK_LINKS}
            onAdd={(p, u) => console.log('add', p, u)}
            onUpdateStatus={(id, s) => console.log('status', id, s)}
            onDelete={(id) => console.log('delete', id)}
          />
        }
        relationshipsSlot={
          <MusicEntityArtistsPanel
            artists={MOCK_ARTISTS}
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
      <div className='space-y-4'>
        <h3 className='font-semibold'>Album form</h3>
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
          onSubmit={(d) => console.log('save album', d)}
        />
      </div>
    </div>
  )
}

interface PanelHeaderProps {
  eyebrow: string
  title: string
  description: string
}

function PanelHeader({ eyebrow, title, description }: PanelHeaderProps) {
  return (
    <header className='max-w-3xl space-y-2'>
      <p className='text-xs uppercase tracking-[0.2em] text-muted-foreground'>
        {eyebrow}
      </p>
      <h2 className='text-3xl font-bold tracking-tight'>{title}</h2>
      <p className='leading-7 text-muted-foreground'>{description}</p>
    </header>
  )
}

export { ComponentPreview }
