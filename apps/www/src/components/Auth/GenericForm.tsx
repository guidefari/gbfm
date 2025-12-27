import type React from 'react'
import type {
  HTMLInputAutoCompleteAttribute,
  HTMLInputTypeAttribute
} from 'react'
import { LockIcon } from '@/components/common/icons'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  fields: FormField[]
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  formTitle: string
  submitButtonText?: string
}

export type FormField = {
  label: string
  name: string
  type: HTMLInputTypeAttribute
  placeholder: string
  required?: boolean
}

const AutoCompleteMatcher = (
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
  submitButtonText
}: Props) => {
  return (
    <div className='flex-col justify-center items-center sm:px-6 lg:px-8'>
      <div className='mx-auto space-y-8 w-full max-w-md'>
        <div className='flex flex-col justify-center items-center space-y-2'>
          <div className='inline-flex items-center px-3 py-1 text-sm font-medium rounded-sm bg-primary text-primary-foreground'>
            <LockIcon className='mr-2 w-4 h-4' />
            {formTitle}
          </div>
        </div>
        <Card>
          <CardContent className='space-y-4'>
            <form onSubmit={onSubmit}>
              <div className='grid gap-3'>
                {fields.map((field) => (
                  <div className='grid gap-1' key={field.name}>
                    <div className='flex justify-between items-center'>
                      <Label htmlFor={field.name}>{field.label}</Label>
                    </div>
                    <Input
                      id={field.name}
                      type={field.type}
                      placeholder={field.placeholder}
                      required={field.required || false}
                      name={field.name}
                      autoComplete={AutoCompleteMatcher(field.type)}
                    />
                  </div>
                ))}
                <Button type='submit' className='w-full'>
                  {submitButtonText || formTitle}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
