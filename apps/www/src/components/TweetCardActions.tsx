import { useFeatureFlag } from '@gbfm/core/feature-flags'
import { toast } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import { Edit3, ImageDown, Link2, MessageSquareQuote } from 'lucide-react'
import { useState } from 'react'
import {
  TweetDownloadDialog,
  type TweetDownloadPost
} from '@/components/tweet-export/TweetDownloadDialog'
import { getShareUrl } from '@/lib/share'
import { log } from '@/services/logger'

type Props = {
  post: TweetDownloadPost
  slug: string
  canEdit: boolean
  replyCount?: number
  replyCountExpanded?: boolean
  onReplyCountClick?: () => void
}

const actionButtonClassName =
  'inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground'

export function TweetCardActions({
  post,
  slug,
  canEdit,
  replyCount,
  replyCountExpanded,
  onReplyCountClick
}: Props) {
  const [downloadOpen, setDownloadOpen] = useState(false)
  const isShareEnabled = useFeatureFlag('ui.share')

  const handleCopyLink = async (event: React.MouseEvent) => {
    event.stopPropagation()
    const shareUrl = getShareUrl('post', slug)
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({ title: 'Link copied!', description: 'Share URL copied to clipboard' })
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
    <div className='flex items-center gap-4'>
      {isShareEnabled && (
        <button type='button' onClick={handleCopyLink} className={actionButtonClassName}>
          <Link2 className='h-3.5 w-3.5' />
          Copy link
        </button>
      )}

      <button
        type='button'
        onClick={(event) => {
          event.stopPropagation()
          setDownloadOpen(true)
        }}
        className={actionButtonClassName}>
        <ImageDown className='h-3.5 w-3.5' />
        Download
      </button>

      {canEdit && (
        <Link
          to='/new/tweet'
          search={{ edit: slug }}
          onClick={(event) => event.stopPropagation()}
          className={actionButtonClassName}>
          <Edit3 className='h-3.5 w-3.5' />
          Edit
        </Link>
      )}

      {Boolean(replyCount) && (
        <button
          type='button'
          aria-expanded={replyCountExpanded}
          onClick={(event) => {
            event.stopPropagation()
            onReplyCountClick?.()
          }}
          className={actionButtonClassName}>
          <MessageSquareQuote className='h-3.5 w-3.5' />
          {replyCountExpanded !== undefined && (replyCountExpanded ? 'Hide' : 'Show')} {replyCount}{' '}
          {replyCount === 1 ? 'reply' : 'replies'}
        </button>
      )}

      <TweetDownloadDialog
        post={post}
        slug={slug}
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
      />
    </div>
  )
}
