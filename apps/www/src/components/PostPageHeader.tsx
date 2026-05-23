import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

interface PostPageHeaderProps {
  title: string
  description: string
  isEditMode: boolean
  backTo?: { to: string; label: string; params?: Record<string, string> }
  switchTo?: {
    to: string
    label: string
    search?: Record<string, string | undefined>
  }
  actions?: React.ReactNode
}

export function PostPageHeader({
  title,
  description,
  isEditMode,
  backTo,
  switchTo,
  actions
}: PostPageHeaderProps) {
  return (
    <header className='mb-8'>
      <div className='flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start'>
        <div>
          {backTo && (
            <Link
              to={backTo.to as never}
              params={backTo.params as never}
              className='inline-flex items-center gap-2 mb-3 text-sm text-muted-foreground hover:text-foreground'>
              <ArrowLeft className='w-4 h-4' />
              {backTo.label}
            </Link>
          )}
          <h1 className='text-3xl font-bold text-gb-highlight'>{title}</h1>
          <p className='mt-1 text-muted-foreground'>{description}</p>
          {!isEditMode && switchTo && (
            <Link
              to={switchTo.to as never}
              search={switchTo.search as never}
              className='mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4'>
              {switchTo.label}
            </Link>
          )}
        </div>
        {actions && <div className='flex gap-3'>{actions}</div>}
      </div>
    </header>
  )
}
