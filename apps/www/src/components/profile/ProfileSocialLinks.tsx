import { toast } from '@gbfm/ui'
import { Share2 } from 'lucide-react'
import type { PublicProfile } from '@/lib/http'
import { getShareUrl } from '@/lib/share'

const BandcampIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='16'
    height='16'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'>
    <path stroke='none' d='M0 0h24v24H0z' fill='none' />
    <path d='M8.5 6h13.5l-7 12h-13z' />
  </svg>
)

const SubstackIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='16'
    height='16'
    viewBox='0 0 24 24'
    fill='currentColor'
    aria-hidden='true'>
    <path d='M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z' />
  </svg>
)

const SoundCloudIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='16'
    height='16'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'>
    <path stroke='none' d='M0 0h24v24H0z' fill='none' />
    <path d='M17 11h1c1.38 0 3 1.274 3 3c0 1.657 -1.5 3 -3 3l-6 0v-10c3 0 4.5 1.5 5 4' />
    <path d='M9 8l0 9' />
    <path d='M6 17l0 -7' />
    <path d='M3 16l0 -2' />
  </svg>
)

const InstagramIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='16'
    height='16'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'>
    <path stroke='none' d='M0 0h24v24H0z' fill='none' />
    <path d='M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4l0 -8' />
    <path d='M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0' />
    <path d='M16.5 7.5v.01' />
  </svg>
)

const XIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='16'
    height='16'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'>
    <path stroke='none' d='M0 0h24v24H0z' fill='none' />
    <path d='M4 4l11.733 16h4.267l-11.733 -16z' />
    <path d='M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772' />
  </svg>
)

const TikTokIcon = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='16'
    height='16'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'>
    <path stroke='none' d='M0 0h24v24H0z' fill='none' />
    <path d='M21 7.917v4.034a9.948 9.948 0 0 1 -5 -1.951v4.5a6.5 6.5 0 1 1 -8 -6.326v4.326a2.5 2.5 0 1 0 4 2v-11.5h4.083a6.005 6.005 0 0 0 4.917 4.917' />
  </svg>
)

const PLATFORM_CONFIG = {
  bandcamp: {
    label: 'Bandcamp',
    color: '#1da0c3',
    Icon: BandcampIcon
  },
  substack: {
    label: 'Substack',
    color: '#ff6719',
    Icon: SubstackIcon
  },
  soundcloud: {
    label: 'SoundCloud',
    color: '#ff5500',
    Icon: SoundCloudIcon
  },
  instagram: {
    label: 'Instagram',
    color: '#e1306c',
    Icon: InstagramIcon
  },
  twitter: {
    label: 'Twitter',
    color: null,
    className: 'text-neutral-900 dark:text-neutral-100',
    Icon: XIcon
  },
  tiktok: {
    label: 'TikTok',
    color: '#ee1d52',
    Icon: TikTokIcon
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
        const Icon = config?.Icon

        return (
          <a
            key={`${link.platform}-${link.position}-${link.url}`}
            href={link.url}
            target='_blank'
            rel='noopener noreferrer'
            className={`flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-muted/30 ${!isLast ? 'border-b border-border' : ''}`}>
            {Icon ? (
              <span
                className={'className' in config ? config.className : undefined}
                style={
                  'color' in config && config.color
                    ? { color: config.color }
                    : undefined
                }>
                <Icon />
              </span>
            ) : (
              <span
                className='h-2 w-2 shrink-0 rounded-full'
                style={{ backgroundColor: '#7ec8da' }}
              />
            )}
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
