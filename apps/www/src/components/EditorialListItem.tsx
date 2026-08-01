import { getMixRecencyLabel } from '@gbfm/core/utils'
import { Badge } from '@gbfm/ui'
import type { SelectMdxCompiledEditorialPost } from '@gbfm/vps/schemas'
import { Link } from '@tanstack/react-router'
import { CalendarDays, Sparkles } from 'lucide-react'
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
          <Badge
            variant='secondary'
            className={`mb-1 ${
              recencyLabel === 'new'
                ? 'rounded-none border-none bg-highlight text-highlight-foreground text-[10px] tracking-widest font-bold gap-1 shadow-sm'
                : 'rounded-none border-none bg-foreground text-black text-[10px] tracking-widest font-bold gap-1 shadow-sm'
            }`}>
            <Sparkles className='w-3 h-3' />
            {recencyLabel}
          </Badge>
        )}
        <Link
          to='/editorial/$slug'
          params={{ slug: post.slug }}
          className='block text-base sm:text-lg font-extrabold leading-tight line-clamp-2 text-foreground hover:underline decoration-foreground/30 underline-offset-4'>
          {post.title}
        </Link>

        {hasCreators && (
          <div className='mt-2 text-xs tracking-widest text-muted-foreground/90'>
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
          </div>
        )}

        {post.description && (
          <div className='mt-2 text-base leading-relaxed text-foreground/70 line-clamp-2'>
            {post.description}
          </div>
        )}

        {post.tags && post.tags.length > 0 && (
          <div className='mt-2 flex flex-wrap items-center gap-1.5'>
            {post.tags.map((postTag) => (
              <Badge
                key={postTag}
                variant='secondary'
                className='rounded-none border-none bg-muted/80 text-foreground/85 text-[10px] tracking-widest px-2 py-1'>
                {postTag}
              </Badge>
            ))}
          </div>
        )}

        {post.createdAt && (
          <div className='mt-2'>
            <Badge
              variant='secondary'
              className='rounded-none border-none bg-muted/90 text-foreground/90 text-[10px] tracking-widest font-semibold px-2 py-1 gap-1.5'>
              <CalendarDays className='w-3.5 h-3.5' />
              {new Date(post.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </Badge>
          </div>
        )}
      </div>
    </article>
  )
}
