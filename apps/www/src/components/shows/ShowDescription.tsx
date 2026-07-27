import { ReadMoreModal } from '@gbfm/ui'
import { MDXRendrr } from '@/components/MDXRendrr'

interface ShowDescriptionProps {
  title: string
  description: string
  compiledContent?: string
}

export function ShowDescription({ title, description, compiledContent }: ShowDescriptionProps) {
  const hasExpandableContent = description.length > 120 || compiledContent

  return (
    <div>
      <div className='text-sm text-muted-foreground line-clamp-4 prose prose-sm prose-neutral dark:prose-invert max-w-none wrap-break-word overflow-hidden [&_p]:text-muted-foreground [&_p]:text-sm'>
        {compiledContent ? <MDXRendrr mdxString={compiledContent} /> : <p>{description}</p>}
      </div>
      {hasExpandableContent && (
        <ReadMoreModal
          title={title}
          trigger={
            <span className='text-sm font-medium text-primary underline underline-offset-4 cursor-pointer hover:opacity-80'>
              read more
            </span>
          }>
          {compiledContent ? <MDXRendrr mdxString={compiledContent} /> : <p>{description}</p>}
        </ReadMoreModal>
      )}
    </div>
  )
}
