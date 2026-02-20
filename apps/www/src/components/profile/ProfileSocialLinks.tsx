import { Share2 } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import type { PublicProfile } from '@/lib/http'
import { getShareUrl } from '@/lib/share'

const PLATFORM_CONFIG = {
  bandcamp: {
    label: 'Bandcamp',
    color: '#ff6b4a'
  },
  substack: {
    label: 'Substack',
    color: '#ff6719'
  },
  soundcloud: {
    label: 'SoundCloud',
    color: '#ff5500'
  },
  instagram: {
    label: 'Instagram',
    color: '#e1306c'
  },
  twitter: {
    label: 'Twitter',
    color: '#1da1f2'
  },
  tiktok: {
    label: 'TikTok',
    color: '#ee1d52'
  }
} as const

type Platform = keyof typeof PLATFORM_CONFIG

interface ProfileSocialLinksProps {
  username: PublicProfile['username']
  socialLinks: PublicProfile['socialLinks']
}

export function ProfileSocialLinks({
  username,
  socialLinks
}: ProfileSocialLinksProps) {
  if (!socialLinks.length && !username) return null

  const sorted = [...socialLinks].sort((a, b) => a.position - b.position)
  const shareUrl = username ? getShareUrl('profile', username) : null

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return

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
    <div className='overflow-hidden rounded-lg bg-card'>
      {sorted.map((link, i) => {
        const config = PLATFORM_CONFIG[link.platform as Platform]
        const isLast = i === sorted.length - 1 && !shareUrl

        return (
          <a
            key={`${link.platform}-${link.position}-${link.url}`}
            href={link.url}
            target='_blank'
            rel='noopener noreferrer'
            className={`flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-muted/30 ${!isLast ? 'border-b border-border' : ''}`}>
            <span
              className='h-2 w-2 shrink-0 rounded-full'
              style={{ backgroundColor: config?.color ?? '#7ec8da' }}
            />
            <span className='flex-1 font-mono text-sm text-foreground'>
              {config?.label ?? link.platform}
            </span>
            <svg
              className='h-3 w-3 shrink-0 text-[#4e8c71]'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              aria-hidden='true'>
              <path d='M7 17L17 7M17 7H7M17 7v10' />
            </svg>
          </a>
        )
      })}
      {shareUrl && (
        <button
          type='button'
          onClick={handleCopyShareUrl}
          className='flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/30'>
          <Share2 className='h-3.5 w-3.5 shrink-0 text-[#4e8c71]' />
          <span className='flex-1 font-mono text-sm text-foreground'>
            Copy profile link
          </span>
        </button>
      )}
    </div>
  )
}
