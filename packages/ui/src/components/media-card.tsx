import type * as React from 'react'
import { cn } from '../lib/cn'
import { Badge } from './badge'

export interface MediaCardProps extends React.HTMLAttributes<HTMLElement> {
  title: string
  eyebrow?: string
  description?: React.ReactNode
  imageUrl: string
  imageAlt?: string
  href?: string
  tags?: string[]
  actions?: React.ReactNode
  footer?: React.ReactNode
}

function MediaCard({
  title,
  eyebrow,
  description,
  imageUrl,
  imageAlt,
  href,
  tags,
  actions,
  footer,
  className,
  ...props
}: MediaCardProps) {
  const image = (
    <img
      className='aspect-square w-full rounded-sm object-cover transition duration-300 group-hover:scale-102'
      src={imageUrl}
      alt={imageAlt ?? title}
      width={480}
      height={480}
      loading='lazy'
    />
  )

  return (
    <article
      className={cn(
        'group overflow-hidden rounded-sm border-2 border-border bg-card text-card-foreground shadow-lg transition duration-300 hover:-translate-y-1 hover:border-highlight/70 hover:shadow-xl',
        className
      )}
      {...props}>
      <div className='overflow-hidden bg-muted'>
        {href ? (
          <a href={href} className='block' aria-label={title}>
            {image}
          </a>
        ) : (
          image
        )}
      </div>
      <div className='space-y-4 p-4'>
        <div className='space-y-2'>
          {eyebrow && <p className='text-xs tracking-[0.2em] text-muted-foreground'>{eyebrow}</p>}
          <h3 className='text-lg font-semibold leading-tight text-foreground'>
            {href ? (
              <a href={href} className='underline-offset-4 hover:text-highlight hover:underline'>
                {title}
              </a>
            ) : (
              title
            )}
          </h3>
          {description && (
            <div className='text-sm leading-6 text-muted-foreground'>{description}</div>
          )}
        </div>
        {tags && tags.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {tags.map((tag) => (
              <Badge key={tag} variant='secondary'>
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
        {footer && <div className='border-t pt-4 text-sm text-muted-foreground'>{footer}</div>}
      </div>
    </article>
  )
}

export { MediaCard }
