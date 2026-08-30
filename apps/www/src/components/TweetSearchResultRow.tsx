import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { MessageCircle, Music4 } from 'lucide-react'
import { TweetSearchReplyContext } from '@/components/TweetSearchReplyContext'
import { apiUrl, fetcher } from '@/lib/http'
import { replyPresentationOf } from '@/lib/tweet-reply-presentation'

type MusicEntityType = 'album' | 'track' | 'playlist'

type MusicEntityPreview = {
  title: string
  artistNames?: string[] | null
}

const entityPathByType = {
  album: 'albums',
  track: 'tracks',
  playlist: 'playlists'
} satisfies Record<MusicEntityType, string>

function isMusicEntityType(value: string | null): value is MusicEntityType {
  return value === 'album' || value === 'track' || value === 'playlist'
}

type Props = {
  slug: string
  title: string | null
  content: string | null
  musicEntityType: string | null
  musicEntityId: string | null
  depth?: number | null
  parentPostId?: string | null
  replyCount?: number
  onClick: () => void
}

export function TweetSearchResultRow({
  slug,
  title,
  content,
  musicEntityType,
  musicEntityId,
  depth,
  parentPostId,
  replyCount,
  onClick
}: Props) {
  const supportedType = isMusicEntityType(musicEntityType) ? musicEntityType : null
  const presentation = replyPresentationOf({ depth, parentPostId })

  const { data } = useQuery<MusicEntityPreview>({
    queryKey: ['music-entity-preview', musicEntityType, musicEntityId],
    queryFn: () => {
      if (!supportedType) {
        return Promise.reject(new Error('Unsupported music entity type'))
      }
      return fetcher(apiUrl(`/music/${entityPathByType[supportedType]}/${musicEntityId}`))
    },
    enabled: Boolean(supportedType && musicEntityId)
  })

  return (
    <Link
      to='/tweet/$slug'
      params={{ slug }}
      onClick={onClick}
      className='block truncate border-b border-border/30 px-3 py-2 text-base last:border-b-0 hover:bg-muted/50'>
      <div className='truncate'>{title || content?.slice(0, 80) || '(untitled)'}</div>
      {presentation.kind === 'reply' && (
        <TweetSearchReplyContext parentPostId={presentation.parentPostId} />
      )}
      {presentation.kind === 'reply-without-parent' && <TweetSearchReplyContext />}
      {data && (
        <div className='mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground'>
          <Music4 className='h-3 w-3 shrink-0 opacity-60' />
          <span className='truncate'>
            {data.title}
            {data.artistNames?.length ? ` · ${data.artistNames.join(', ')}` : ''}
          </span>
        </div>
      )}
      {Boolean(replyCount) && (
        <div className='mt-0.5 flex items-center gap-1 text-xs text-muted-foreground'>
          <MessageCircle className='h-3 w-3 shrink-0 opacity-60' />
          <span>
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </span>
        </div>
      )}
    </Link>
  )
}
