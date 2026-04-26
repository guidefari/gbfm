import { Eye, EyeOff, Loader2 } from 'lucide-react'
import type React from 'react'
import {
  type HTMLInputAutoCompleteAttribute,
  type HTMLInputTypeAttribute,
  type ReactNode,
  useState
} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Props = {
  fields: FormField[]
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  formTitle: string
  submitButtonText?: string
  isSubmitting?: boolean
  submitDisabled?: boolean
  beforeSubmit?: ReactNode
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
  onChange?: (value: string) => void
  rightSlot?: ReactNode
  belowField?: ReactNode
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

const inputClass =
  'h-11 border-gb-pastel-green-2/30 bg-gb-darker-bg/60 text-foreground placeholder:text-muted-foreground/80 focus-visible:ring-gb-highlight'

function FieldInput({ field }: { field: FormField }) {
  const [show, setShow] = useState(false)
  const isPassword = field.type === 'password'
  const effectiveType = isPassword && show ? 'text' : field.type
  const autoComplete = field.autoComplete || autoCompleteMatcher(field.type)

  const input = (
    <Input
      id={field.name}
      type={effectiveType}
      placeholder={field.placeholder}
      required={field.required || false}
      name={field.name}
      autoComplete={autoComplete}
      autoFocus={field.autoFocus}
      onChange={
        field.onChange ? (e) => field.onChange?.(e.target.value) : undefined
      }
      className={cn(inputClass, (isPassword || field.rightSlot) && 'pr-10')}
    />
  )

  if (!isPassword && !field.rightSlot) return input

  return (
    <div className='relative'>
      {input}
      <div className='absolute inset-y-0 right-0 flex items-center pr-3'>
        {isPassword ? (
          <button
            type='button'
            onClick={() => setShow((s) => !s)}
            tabIndex={-1}
            aria-label={show ? 'Hide password' : 'Show password'}
            className='text-muted-foreground hover:text-gb-pastel-green-1'>
            {show ? (
              <EyeOff className='h-4 w-4' />
            ) : (
              <Eye className='h-4 w-4' />
            )}
          </button>
        ) : (
          field.rightSlot
        )}
      </div>
    </div>
  )
}

export const GenericAuthForm = ({
  fields,
  onSubmit,
  formTitle,
  submitButtonText,
  isSubmitting = false,
  submitDisabled = false,
  beforeSubmit
}: Props) => {
  return (
    <form onSubmit={onSubmit} aria-label={formTitle}>
      <div className='grid gap-4'>
        {fields.map((field) => (
          <div className='grid gap-1.5' key={field.name}>
            <Label htmlFor={field.name} className='text-gb-pastel-green-1'>
              {field.label}
            </Label>
            <FieldInput field={field} />
            {field.helperText ? (
              <p className='text-xs leading-5 text-muted-foreground'>
                {field.helperText}
              </p>
            ) : null}
            {field.belowField}
          </div>
        ))}
        {beforeSubmit}
        <Button
          type='submit'
          className='mt-2 w-full'
          size='lg'
          disabled={isSubmitting || submitDisabled}>
          {isSubmitting ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : null}
          {submitButtonText || formTitle}
        </Button>
      </div>
    </form>
  )
}
