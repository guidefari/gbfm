import { Loader2 } from 'lucide-react'
import type React from 'react'
import type {
  HTMLInputAutoCompleteAttribute,
  HTMLInputTypeAttribute
} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  fields: FormField[]
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  formTitle: string
  submitButtonText?: string
  isSubmitting?: boolean
}

export type FormField = {
  label: string
  name: string
  type: HTMLInputTypeAttribute
  placeholder: string
  required?: boolean
  autoComplete?: HTMLInputAutoCompleteAttribute
  autoFocus?: boolean
  helperText?: string
}

const autoCompleteMatcher = (
  type: HTMLInputTypeAttribute
): HTMLInputAutoCompleteAttribute => {
  switch (type) {
    case 'email':
      return 'email'
    case 'password':
      return 'current-password'
    default:
      return 'off'
  }
}

export const GenericAuthForm = ({
  fields,
  onSubmit,
  formTitle,
  submitButtonText,
  isSubmitting = false
}: Props) => {
  return (
    <form onSubmit={onSubmit} aria-label={formTitle}>
      <div className='grid gap-4'>
        {fields.map((field) => (
          <div className='grid gap-1.5' key={field.name}>
            <Label htmlFor={field.name} className='text-gb-pastel-green-1'>
              {field.label}
            </Label>
            <Input
              id={field.name}
              type={field.type}
              placeholder={field.placeholder}
              required={field.required || false}
              name={field.name}
              autoComplete={
                field.autoComplete || autoCompleteMatcher(field.type)
              }
              autoFocus={field.autoFocus}
              className='h-11 border-gb-pastel-green-2/30 bg-gb-darker-bg/60 text-foreground placeholder:text-muted-foreground/80 focus-visible:ring-gb-highlight'
            />
            {field.helperText ? (
              <p className='text-xs leading-5 text-muted-foreground'>
                {field.helperText}
              </p>
            ) : null}
          </div>
        ))}
        <Button
          type='submit'
          className='mt-2 w-full'
          size='lg'
          disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : null}
          {submitButtonText || formTitle}
        </Button>
      </div>
    </form>
  )
}
