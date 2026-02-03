import { ImageIcon, Loader2, Tag, Upload, X } from 'lucide-react'
import { useId } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { generateSlug } from '@/hooks/useFileUpload'

interface Show {
  id: string
  title: string
}

interface User {
  id: string
  name: string
  displayUsername?: string | null
}

interface MixDetailsFormProps {
  title: string
  description: string
  slug: string
  tags: string[]
  creatorId?: string
  showId?: string
  episodeNumber?: string
  artworkPreview: string | null
  availableTags: string[]
  allShows?: Show[]
  usersList?: User[]
  currentUser?: User | null
  isAdmin: boolean
  isEditMode: boolean
  isUpdatingTags?: boolean
  newTag: string
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onSlugChange: (value: string) => void
  onCreatorChange: (value: string) => void
  onShowChange: (value: string) => void
  onEpisodeNumberChange: (value: string) => void
  onToggleTag: (tag: string) => void
  onNewTagChange: (value: string) => void
  onAddNewTag: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onArtworkChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveArtwork: () => void
}

export function MixDetailsForm({
  title,
  description,
  slug,
  tags,
  creatorId,
  showId,
  episodeNumber,
  artworkPreview,
  availableTags,
  allShows,
  usersList,
  currentUser,
  isAdmin,
  isEditMode,
  isUpdatingTags,
  newTag,
  onTitleChange,
  onDescriptionChange,
  onSlugChange,
  onCreatorChange,
  onShowChange,
  onEpisodeNumberChange,
  onToggleTag,
  onNewTagChange,
  onAddNewTag,
  onArtworkChange,
  onRemoveArtwork
}: MixDetailsFormProps) {
  const artworkUploadId = useId()

  return (
    <Card className='bg-gb-darker-bg border-gb-pastel-green-2/20'>
      <CardContent className='pt-6 space-y-6'>
        <div className='space-y-2'>
          <Label className='text-gb-pastel-green-1'>Mix Title</Label>
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder='Summer Solstice Set 2024'
            className='bg-gb-bg border-gb-pastel-green-2/30'
          />
        </div>

        <div className='space-y-2'>
          <Label className='text-gb-pastel-green-1'>Short Description</Label>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder='A deep dive into progressive sounds recorded live...'
            className='bg-gb-bg border-gb-pastel-green-2/30'
          />
        </div>

        <div className='space-y-2'>
          <Label className='text-gb-pastel-green-1'>URL Slug</Label>
          <Input
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder='url-friendly-slug'
            className='bg-gb-bg border-gb-pastel-green-2/30'
          />
          {title && !slug && (
            <p className='text-xs text-muted-foreground'>
              Will be: {generateSlug(title)}
            </p>
          )}
        </div>

        {isAdmin && usersList && (
          <div className='space-y-2'>
            <Label className='text-gb-pastel-green-1'>Creator</Label>
            <Select value={creatorId} onValueChange={onCreatorChange}>
              <SelectTrigger className='bg-gb-bg border-gb-pastel-green-2/30'>
                <SelectValue placeholder='Select creator' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={currentUser?.id || 'current'}>
                  {currentUser?.displayUsername || currentUser?.name} (Me)
                </SelectItem>
                {usersList
                  .filter((u) => u.id !== currentUser?.id)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.displayUsername || u.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {allShows && (
          <div className='space-y-2'>
            <Label className='text-gb-pastel-green-1'>
              Radio Show (Optional)
            </Label>
            <Select
              value={showId}
              onValueChange={(value) =>
                onShowChange(value === 'none' ? '' : value)
              }>
              <SelectTrigger className='bg-gb-bg border-gb-pastel-green-2/30'>
                <SelectValue placeholder='Select show' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>None</SelectItem>
                {allShows.map((show) => (
                  <SelectItem key={show.id} value={show.id}>
                    {show.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showId && (
          <div className='space-y-2'>
            <Label className='text-gb-pastel-green-1'>Episode Number</Label>
            <Input
              type='number'
              value={episodeNumber || ''}
              onChange={(e) => onEpisodeNumberChange(e.target.value)}
              placeholder='e.g. 42'
              className='bg-gb-bg border-gb-pastel-green-2/30'
            />
          </div>
        )}

        <div className='space-y-2'>
          <Label className='text-gb-pastel-green-1'>
            Genre Tags
            {isUpdatingTags && isEditMode && (
              <Loader2 className='inline w-3 h-3 ml-2 animate-spin' />
            )}
          </Label>
          <div className='flex flex-wrap gap-2 mb-4'>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type='button'
                onClick={() => onToggleTag(tag)}
                className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-all ${
                  tags.includes(tag)
                    ? 'bg-gb-pastel-green-2 border-gb-pastel-green-2 text-gb-darker-bg'
                    : 'bg-transparent border-gb-pastel-green-2/30 text-gb-default-text hover:border-gb-highlight/50'
                }`}>
                {tag}
              </button>
            ))}
          </div>
          <div className='relative'>
            <Tag className='absolute w-4 h-4 left-3 top-3.5 text-muted-foreground' />
            <Input
              value={newTag}
              onChange={(e) => onNewTagChange(e.target.value)}
              onKeyDown={onAddNewTag}
              placeholder='Add custom tag (Press Enter)'
              className='pl-10 bg-gb-bg border-gb-pastel-green-2/30'
            />
          </div>
          {tags.length > 0 && (
            <div className='flex flex-wrap gap-2 mt-3'>
              {tags
                .filter((tag) => !availableTags.includes(tag))
                .map((tag) => (
                  <Badge
                    key={tag}
                    variant='secondary'
                    className='flex items-center gap-1 bg-gb-pastel-green-2/20 text-gb-pastel-green-1'>
                    {tag}
                    <X
                      className='w-3 h-3 cursor-pointer hover:text-gb-highlight'
                      onClick={() => onToggleTag(tag)}
                    />
                  </Badge>
                ))}
            </div>
          )}
        </div>

        <div className='space-y-2'>
          <Label className='text-gb-pastel-green-1'>Artwork</Label>
          {!artworkPreview ? (
            <div className='p-4 text-center transition-colors border-2 border-dashed rounded-sm border-gb-pastel-green-2/30 hover:border-gb-highlight/50'>
              <ImageIcon className='w-6 h-6 mx-auto mb-2 text-gb-pastel-green-2' />
              <p className='mb-2 text-xs text-muted-foreground'>
                Upload cover artwork
              </p>
              <input
                type='file'
                accept='image/*'
                onChange={onArtworkChange}
                className='hidden'
                id={artworkUploadId}
              />
              <label htmlFor={artworkUploadId}>
                <Button
                  variant='outline'
                  size='sm'
                  className='bg-transparent cursor-pointer border-gb-pastel-green-2/30 text-gb-pastel-green-1 hover:bg-gb-pastel-green-2/20'
                  asChild>
                  <span>
                    <Upload className='w-4 h-4 mr-2' />
                    Choose Image
                  </span>
                </Button>
              </label>
            </div>
          ) : (
            <div className='space-y-3'>
              <div className='relative overflow-hidden border rounded-sm aspect-square bg-gb-bg border-gb-pastel-green-2/20 max-w-[200px]'>
                <img
                  src={artworkPreview}
                  alt='Artwork preview'
                  className='object-cover w-full h-full'
                />
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={onRemoveArtwork}
                  className='absolute text-white top-2 right-2 bg-black/50 hover:bg-black/70'>
                  <X className='w-4 h-4' />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
