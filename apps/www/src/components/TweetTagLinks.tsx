import { Link } from '@tanstack/react-router'

type Props = {
  tags: readonly string[]
}

export function TweetTagLinks({ tags }: Props) {
  if (!tags.length) return null

  return (
    <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
      {tags.map((tag) => (
        <Link
          key={tag}
          to='/tags/$tag'
          params={{ tag }}
          onClick={(event) => event.stopPropagation()}
          className='text-xs font-medium text-muted-foreground no-underline transition-colors hover:text-foreground'>
          #{tag}
        </Link>
      ))}
    </div>
  )
}
