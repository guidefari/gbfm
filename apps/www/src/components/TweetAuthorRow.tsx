import type { SelectMdxCompiledPost } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'
import { usePublicProfile } from '@/lib/http'

type Props = {
  creators: NonNullable<SelectMdxCompiledPost['creators']>
  createdAt?: string | Date | null
  interactive?: boolean
}

export function TweetAuthorRow({
  creators,
  createdAt,
  interactive = true
}: Props) {
  const primaryCreator = creators[0]
  const username = primaryCreator?.username ?? null
  const { data: profile } = usePublicProfile(username || '')
  const avatarUrl = profile?.image || DEFAULT_IMAGE_URL

  if (!primaryCreator) {
    return null
  }

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : null

  const avatarImg = (
    <img
      src={avatarUrl}
      alt={`${primaryCreator.name}'s avatar`}
      className='h-10 w-10 object-cover'
      loading='lazy'
    />
  )

  const linkable = interactive && username

  return (
    <div className='flex min-w-0 items-center gap-3'>
      {linkable ? (
        <Link
          to='/profile/$username'
          params={{ username }}
          className='shrink-0 overflow-hidden rounded-sm ring-1 ring-border/60 transition-transform hover:scale-[1.02]'>
          {avatarImg}
        </Link>
      ) : (
        <div className='shrink-0 overflow-hidden rounded-sm ring-1 ring-border/60'>
          {avatarImg}
        </div>
      )}

      <div className='min-w-0 leading-tight'>
        {linkable ? (
          <Link
            to='/profile/$username'
            params={{ username }}
            className='block truncate font-bold text-foreground hover:underline'>
            {primaryCreator.name}
          </Link>
        ) : (
          <span className='block truncate font-bold text-foreground'>
            {primaryCreator.name}
          </span>
        )}
        <div className='flex items-center gap-1.5 truncate text-sm text-muted-foreground'>
          {username ? (
            linkable ? (
              <Link
                to='/profile/$username'
                params={{ username }}
                className='truncate hover:text-foreground hover:underline'>
                @{username}
              </Link>
            ) : (
              <span className='truncate'>@{username}</span>
            )
          ) : null}
          {username && formattedDate ? (
            <span aria-hidden className='text-muted-foreground/50'>
              ·
            </span>
          ) : null}
          {formattedDate ? (
            <span className='shrink-0 font-mono text-xs text-muted-foreground/70'>
              {formattedDate}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
