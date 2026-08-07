import { useFeatureFlag } from '@gbfm/core/feature-flags'
import { canCreatePosts } from '@gbfm/core/roles'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast
} from '@gbfm/ui'
import type { SelectMdxCompiledMicroPost } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
import { Edit3, ImageDown, Pencil, PenSquare, Search, Share2, Shuffle } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { useRandomMicroPost } from '@/lib/http'
import { getShareUrl } from '@/lib/share'
import { log } from '@/services/logger'
import { TweetSearchDialog } from '@/components/TweetSearchDialog'
import { TweetDownloadDialog } from '@/components/tweet-export/TweetDownloadDialog'

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
  const { data: session } = useSession()
  const user = session?.user
  const canCreate = Boolean(user && canCreatePosts(user.role))

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
          <button
            type='button'
            aria-label='Tweet actions'
            className='fixed bottom-[calc(env(safe-area-inset-bottom)+3.75rem)] right-4 z-50 flex h-12 w-12 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:bg-primary/90 lg:bottom-16 lg:right-8'>
            <Pencil className='h-5 w-5' />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' side='top' className='min-w-44'>
          {canCreate && (
            <DropdownMenuItem asChild>
              <Link to='/new/tweet'>
                <PenSquare className='mr-2 h-4 w-4' />
                new tweet
              </Link>
            </DropdownMenuItem>
          )}
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
