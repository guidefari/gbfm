import { useFeatureFlag } from '@gbfm/core/feature-flags'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast
} from '@gbfm/ui'
import type { SelectMdxCompiledMicroPost } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
import { Edit3, ImageDown, MoreHorizontal, Search, Share2, Shuffle } from 'lucide-react'
import { useState } from 'react'
import { TweetSearchDialog } from '@/components/TweetSearchDialog'
import { TweetDownloadDialog } from '@/components/tweet-export/TweetDownloadDialog'
import { useRandomMicroPost } from '@/lib/http'
import { getShareUrl } from '@/lib/share'
import { log } from '@/services/logger'

type Props = {
  post: SelectMdxCompiledMicroPost
  slug: string
  canEdit: boolean
}

export function TweetActionsMenu({ post, slug, canEdit }: Props) {
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const isShareEnabled = useFeatureFlag('ui.share')
  const { goToRandom } = useRandomMicroPost()

  const handleShare = async () => {
    const shareUrl = getShareUrl('post', slug)
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({
        title: 'Link copied!',
        description: 'Share URL copied to clipboard'
      })
    } catch (error) {
      log('error', 'Failed to copy link to clipboard', { slug, error })
      toast({
        title: 'Failed to copy',
        description: 'Could not copy link to clipboard',
        variant: 'destructive'
      })
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            aria-label='Tweet actions'
            className='h-8 w-8 rounded-md text-muted-foreground hover:text-foreground'>
            <MoreHorizontal className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='min-w-44'>
          {canEdit && (
            <DropdownMenuItem asChild>
              <Link to='/new/tweet' search={{ edit: slug }}>
                <Edit3 className='mr-2 h-4 w-4' />
                edit
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              setTimeout(() => setDownloadOpen(true), 0)
            }}>
            <ImageDown className='mr-2 h-4 w-4' />
            download for socials
          </DropdownMenuItem>
          {isShareEnabled && (
            <DropdownMenuItem onSelect={handleShare}>
              <Share2 className='mr-2 h-4 w-4' />
              copy link
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              setTimeout(() => setSearchOpen(true), 0)
            }}>
            <Search className='mr-2 h-4 w-4' />
            search
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => goToRandom(slug)}>
            <Shuffle className='mr-2 h-4 w-4' />
            random tweet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TweetDownloadDialog
        post={post}
        slug={slug}
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
      />
      <TweetSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
