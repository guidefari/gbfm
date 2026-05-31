import { useFeatureFlag } from '@gbfm/core/feature-flags'
import { Button, toast } from '@gbfm/ui'
import { Share2 } from 'lucide-react'
import { getShareUrl, type ShareContentType } from '@/lib/share'

interface ShareButtonProps {
  type: ShareContentType
  slug: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function ShareButton({
  type,
  slug,
  variant = 'outline',
  size = 'sm',
  className
}: ShareButtonProps) {
  const isShareEnabled = useFeatureFlag('ui.share')

  if (!isShareEnabled) return null

  const handleShare = async () => {
    const shareUrl = getShareUrl(type, slug)

    try {
      await navigator.clipboard.writeText(shareUrl)
      toast({
        title: 'Link copied!',
        description: 'Share URL copied to clipboard'
      })
    } catch (error) {
      console.error('Failed to copy link to clipboard:', error)
      toast({
        title: 'Failed to copy',
        description: 'Could not copy link to clipboard',
        variant: 'destructive'
      })
    }
  }

  return (
    <Button onClick={handleShare} variant={variant} size={size} className={className} title='Share'>
      <Share2 className='w-4 h-4' />
    </Button>
  )
}
