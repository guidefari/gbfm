import { Button } from '@gbfm/ui'
import { Loader2, Save, Send } from 'lucide-react'
import type { ReactNode } from 'react'
import type { EditorialSaveState } from './-editorial-types'

const saveStateCopy = {
  saved: 'All changes saved',
  unsaved: 'Unsaved changes',
  uploading: 'Uploading artwork',
  saving: 'Saving changes',
  error: 'Could not save changes'
} satisfies Record<EditorialSaveState, string>

function saveStateClassName(saveState: EditorialSaveState) {
  if (saveState === 'error') return 'text-destructive'
  if (saveState === 'unsaved') return 'text-gb-highlight'
  return 'text-muted-foreground'
}

export function EditorialWorkspaceHeader({
  title,
  navigation,
  saveState,
  isSaving,
  canSave,
  onDiscard,
  onSaveDraft,
  onPublish
}: {
  title: string
  navigation: ReactNode
  saveState: EditorialSaveState
  isSaving: boolean
  canSave: boolean
  onDiscard: () => void
  onSaveDraft: () => void
  onPublish: () => void
}) {
  return (
    <header className='sticky top-0 z-20 -mx-4 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8'>
      <div className='mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4'>
        <div className='min-w-0 space-y-1'>
          {navigation}
          <h1 className='truncate text-lg font-semibold text-foreground'>{title}</h1>
        </div>

        <div className='ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto'>
          <span
            role='status'
            aria-live='polite'
            className={`basis-full text-right text-xs font-medium sm:mr-1 sm:basis-auto ${saveStateClassName(saveState)}`}>
            {isSaving ? <Loader2 className='mr-1 inline size-3 animate-spin' /> : null}
            {saveStateCopy[saveState]}
          </span>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={onDiscard}
            disabled={isSaving}
            className='h-9 px-2.5 text-sm sm:px-3.5'
            aria-label='Discard unsaved changes'>
            Discard
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={onSaveDraft}
            disabled={!canSave || isSaving}
            className='h-9 gap-1.5 px-2.5 text-sm sm:gap-2 sm:px-4'>
            <Save className='size-3.5' />
            Save draft
          </Button>
          <Button
            type='button'
            size='sm'
            onClick={onPublish}
            disabled={!canSave || isSaving}
            className='h-9 gap-1.5 px-2.5 text-sm sm:gap-2 sm:px-4'>
            <Send className='size-3.5' />
            Publish
          </Button>
        </div>
      </div>
    </header>
  )
}
