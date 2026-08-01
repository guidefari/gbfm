import { useForm } from 'react-hook-form'
import { Button } from './button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from './form'
import { Input } from './input'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Forms/Form'
}

type FormValues = {
  email: string
  username: string
}

export function FormWithValidation() {
  const methods = useForm<FormValues>({
    defaultValues: { email: '', username: '' }
  })

  const onSubmit = (data: FormValues) => {
    console.log('submitted', data)
  }

  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Form'
        title='Form'
        description='react-hook-form wrapper with accessible field labelling, descriptions, and error messages.'
      />
      <div className='max-w-sm'>
        <Form {...methods} onSubmit={onSubmit}>
          <FormField
            control={methods.control}
            name='email'
            rules={{
              required: 'Email is required',
              pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' }
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder='you@example.com' {...field} />
                </FormControl>
                <FormDescription>Used for account notifications.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={methods.control}
            name='username'
            rules={{
              required: 'Username is required',
              minLength: { value: 3, message: 'Min 3 characters' }
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder='burial' {...field} />
                </FormControl>
                <FormDescription>Your unique handle on the platform.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type='submit'>Submit</Button>
        </Form>
      </div>
    </div>
  )
}
