import { Music, Radio, Search, User } from 'lucide-react'
import { useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion'
import { Badge } from './badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from './breadcrumb'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Checkbox } from './checkbox'
import { IconGrid } from './icon-grid'
import { Input } from './input'
import { Label } from './label'
import { LilDate } from './lil-date'
import { MediaCard } from './media-card'
import { OverflowTitle } from './overflow-title'
import { PageTitle } from './page-title'
import { PasswordChecklist } from './password-checklist'
import { ProfilePreviewCard } from './profile-preview-card'
import { ReadMoreModal } from './read-more-modal'
import { Section } from './section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Skeleton } from './skeleton'
import { mediaExamples, StoryPanelHeader, storyPanelClassName } from './story-helpers'
import { TagsInput } from './tags-input'
import { Textarea } from './textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { UploadProgress } from './upload-progress'

export default {
  title: '@gbfm/ui/KitchenSink'
}

const tiles = [
  { id: 'mixes', label: 'Mixes', icon: Music, onSelect: () => {} },
  { id: 'radio', label: 'Radio', icon: Radio, onSelect: () => {} },
  { id: 'profile', label: 'Profile', icon: User, onSelect: () => {} },
  { id: 'search', label: 'Search', icon: Search, onSelect: () => {} }
]

export function KitchenSink() {
  const [tags, setTags] = useState(['dub', 'leftfield'])
  const [password, setPassword] = useState('')
  const [checked, setChecked] = useState(false)

  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Composite'
        title='Kitchen Sink'
        description='Every component in one place. Use this to spot regressions and theme drift.'
      />

      <Section title='Navigation'>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href='/'>Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href='/mixes'>Mixes</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Late Night Transmissions 04</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Section>

      <Section title='Page Header'>
        <div className='border border-border'>
          <PageTitle
            title='Browse Mixes'
            description='A curated archive of live sets and studio mixes.'
          />
        </div>
      </Section>

      <Section title='Quick Nav'>
        <IconGrid tiles={tiles} onTileSelect={(t) => console.log(t.id)} isAuthenticated={true} />
      </Section>

      <Section title='Media Cards'>
        <div className='grid gap-5 md:grid-cols-2'>
          {mediaExamples.map((ex) => (
            <MediaCard
              key={ex.title}
              title={ex.title}
              eyebrow={ex.eyebrow}
              imageUrl={ex.imageUrl}
              description={ex.description}
              tags={ex.tags}
              actions={
                <>
                  <Button size='sm'>Play</Button>
                  <Button size='sm' variant='outline'>
                    Save
                  </Button>
                </>
              }
              footer={<LilDate date='2024-03-15' />}
            />
          ))}
        </div>
      </Section>

      <Section title='Typography'>
        <div className='space-y-4'>
          <div className='w-48 border border-border p-2'>
            <OverflowTitle text='Late Night Transmissions Vol. 04 — An Extremely Long Title That Should Marquee' />
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge>dub</Badge>
            <Badge variant='secondary'>leftfield</Badge>
            <Badge variant='outline'>club</Badge>
            <Badge variant='destructive'>nsfw</Badge>
          </div>
        </div>
      </Section>

      <Section title='Form Controls'>
        <Card className='max-w-md'>
          <CardHeader>
            <CardTitle>Upload details</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-1.5'>
              <Label htmlFor='title'>Title</Label>
              <Input id='title' placeholder='Mix title...' />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='genre'>Genre</Label>
              <Select>
                <SelectTrigger id='genre'>
                  <SelectValue placeholder='Select genre' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='dub'>Dub</SelectItem>
                  <SelectItem value='techno'>Techno</SelectItem>
                  <SelectItem value='ambient'>Ambient</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='notes'>Notes</Label>
              <Textarea id='notes' placeholder='Recorded live at...' />
            </div>
            <div className='grid gap-1.5'>
              <Label htmlFor='pw'>Password</Label>
              <Input
                id='pw'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='••••••••'
              />
              <PasswordChecklist password={password} />
            </div>
            <div className='flex items-center gap-2'>
              <Checkbox
                id='public'
                checked={checked}
                onCheckedChange={(v) => setChecked(Boolean(v))}
              />
              <Label htmlFor='public'>Make mix public</Label>
            </div>
            <TagsInput
              tags={tags}
              onAddTag={(t) => setTags((p) => [...p, t])}
              onRemoveTag={(t) => setTags((p) => p.filter((x) => x !== t))}
              contentTypeLabel='mix'
            />
          </CardContent>
        </Card>
      </Section>

      <Section title='Upload Progress'>
        <UploadProgress step='uploading-audio' title='Late Night Transmissions 04' />
      </Section>

      <Section title='Profile'>
        <div className='max-w-sm'>
          <ProfilePreviewCard displayName='Burial' username='burial' />
        </div>
      </Section>

      <Section title='Accordion & Read More'>
        <div className='max-w-md space-y-4'>
          <Accordion type='single' collapsible>
            <AccordionItem value='tracklist'>
              <AccordionTrigger>Tracklist</AccordionTrigger>
              <AccordionContent>
                <ol className='list-decimal pl-4 space-y-1 text-sm text-muted-foreground'>
                  <li>Burial — Archangel</li>
                  <li>Four Tet — She Moves She</li>
                  <li>Actress — Maze</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <ReadMoreModal
            title='About this mix'
            trigger={
              <span className='underline cursor-pointer text-sm text-muted-foreground'>
                Read full description...
              </span>
            }>
            <p>
              Dubwise pressure, loose percussion, and slow-burning warehouse records recorded live.
            </p>
          </ReadMoreModal>
        </div>
      </Section>

      <Section title='Skeleton Loading'>
        <div className='space-y-3 max-w-md'>
          <Skeleton className='h-8 w-48' />
          <Skeleton className='h-4 w-full' />
          <Skeleton className='h-4 w-3/4' />
          <Skeleton className='h-40 w-full' />
        </div>
      </Section>

      <Section title='Tooltip'>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant='outline'>Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>Add to queue</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Section>
    </div>
  )
}
