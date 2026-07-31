import { Checkbox } from './checkbox'
import { Input } from './input'
import { Label } from './label'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Primitives/Label'
}

export function Labels() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Form'
        title='Label'
        description='Accessible form labels that associate with their controls.'
      />
      <div className='space-y-6 max-w-sm'>
        <div className='grid gap-1.5'>
          <Label htmlFor='email'>Email address</Label>
          <Input id='email' type='email' placeholder='you@example.com' />
        </div>
        <div className='flex items-center gap-2'>
          <Checkbox id='terms' />
          <Label htmlFor='terms'>Accept terms and conditions</Label>
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='disabled-input' className='opacity-50'>
            Disabled field
          </Label>
          <Input id='disabled-input' disabled placeholder='Not editable' />
        </div>
      </div>
    </div>
  )
}
