import { getMixRecencyLabel } from '@gbfm/core/utils'
import type { SelectMdxCompiledEditorialPost } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
import { Sparkles } from 'lucide-react'
import { DEFAULT_IMAGE_URL } from '@/lib/constants'

interface EditorialListItemProps {
  post: SelectMdxCompiledEditorialPost
}

export function EditorialListItem({ post }: EditorialListItemProps) {
  const recencyLabel = getMixRecencyLabel(post.createdAt)
  const hasCreators = Boolean(post.creators && post.creators.length > 0)

  return (
    <article className='group relative flex gap-3 items-start border border-border bg-card p-3 sm:p-4 transition-all duration-200 hover:bg-muted hover:border-foreground hover:shadow-sm'>
      <img
        src={post.thumbnailUrl || DEFAULT_IMAGE_URL}
        alt={post.title}
        className='object-cover transition-transform duration-300 border w-16 h-16 sm:w-20 sm:h-20 border-border bg-background group-hover:scale-101 shrink-0'
      />

      <div className='flex-1 min-w-0'>
        {recencyLabel && (
          <div
            className={`mb-1 flex items-center gap-1 text-[10px] font-bold tracking-widest ${
              recencyLabel === 'new' ? 'text-highlight' : 'text-muted-foreground'
            }`}>
            <Sparkles className='w-3 h-3' />
            {recencyLabel}
          </div>
        )}
        <Link
          to='/editorial/$slug'
          params={{ slug: post.slug }}
          className='block text-base sm:text-lg font-extrabold leading-tight line-clamp-2 text-foreground hover:underline decoration-foreground/30 underline-offset-4'>
          {post.title}
        </Link>

        {(hasCreators || post.createdAt) && (
          <div className='mt-2 flex flex-wrap items-center gap-x-1.5 text-xs tracking-widest text-muted-foreground/90'>
            {hasCreators && (
              <>
                <span className='opacity-60'>By </span>
                {post.creators?.map((creator, index) => (
                  <span key={creator.id}>
                    {creator.username ? (
                      <Link
                        to='/profile/$username'
                        params={{ username: creator.username }}
                        className='font-semibold text-foreground/90 hover:text-foreground hover:underline'>
                        {creator.name}
                      </Link>
                    ) : (
                      <span className='font-semibold text-foreground/90'>{creator.name}</span>
                    )}
                    {index < (post.creators?.length || 0) - 1 && (
                      <span className='mx-1 opacity-50'>&</span>
                    )}
                  </span>
                ))}
              </>
            )}
            {hasCreators && post.createdAt && <span className='opacity-40'>&middot;</span>}
            {post.createdAt && (
              <span>
                {new Date(post.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            )}
          </div>
        )}

        {post.description && (
          <div className='mt-2 text-base leading-relaxed text-foreground/70 line-clamp-2'>
            {post.description}
          </div>
        )}

        {post.tags && post.tags.length > 0 && (
          <div className='mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs tracking-wide text-muted-foreground/80'>
            {post.tags.map((postTag) => (
              <Link
                key={postTag}
                to='/editorial'
                search={{ tag: postTag }}
                onClick={(e) => e.stopPropagation()}
                className='hover:text-foreground hover:underline'>
                #{postTag}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
