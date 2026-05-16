import { useState } from 'react'
import { Input } from './input'
import { Label } from './label'
import { PasswordChecklist } from './password-checklist'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/PasswordChecklist'
}

export function PasswordChecklists() {
  const [password, setPassword] = useState('')

  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Form'
        title='PasswordChecklist'
        description='Live validation feedback as the user types a password.'
      />
      <div className='max-w-sm space-y-3'>
        <div className='grid gap-1.5'>
          <Label htmlFor='pw'>Password</Label>
          <Input
            id='pw'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='Type a password...'
          />
        </div>
        <PasswordChecklist password={password} />
      </div>
    </div>
  )
}
