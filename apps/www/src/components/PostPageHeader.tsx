interface PostPageHeaderProps {
  title: string
  description: string
  isEditMode: boolean
  backLink?: React.ReactNode
  switchLink?: React.ReactNode
  actions?: React.ReactNode
}

export function PostPageHeader({
  title,
  description,
  isEditMode,
  backLink,
  switchLink,
  actions
}: PostPageHeaderProps) {
  return (
    <header className='mb-8'>
      <div className='flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start'>
        <div>
          {backLink}
          <h1 className='text-3xl font-bold text-gb-highlight'>{title}</h1>
          <p className='mt-1 text-muted-foreground'>{description}</p>
          {!isEditMode ? switchLink : null}
        </div>
        {actions && <div className='flex gap-3'>{actions}</div>}
      </div>
    </header>
  )
}
