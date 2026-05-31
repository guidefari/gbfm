import { useState } from 'react'
import { GenericAuthForm } from './generic-auth-form'
import { PasswordChecklist } from './password-checklist'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/GenericAuthForm'
}

export function AuthForms() {
  const [password, setPassword] = useState('')

  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Auth'
        title='GenericAuthForm'
        description='Configurable auth form used for login and sign-up flows.'
      />
      <div className='grid gap-10 md:grid-cols-2 max-w-2xl'>
        <div>
          <p className='text-xs uppercase tracking-widest text-muted-foreground mb-4'>Sign in</p>
          <GenericAuthForm
            formTitle='Sign in'
            submitButtonText='Continue'
            fields={[
              {
                label: 'Email',
                name: 'email',
                type: 'email',
                placeholder: 'you@example.com',
                required: true
              },
              {
                label: 'Password',
                name: 'password',
                type: 'password',
                placeholder: '••••••••',
                required: true
              }
            ]}
            onSubmit={async (e) => e.preventDefault()}
          />
        </div>
        <div>
          <p className='text-xs uppercase tracking-widest text-muted-foreground mb-4'>
            Create account
          </p>
          <GenericAuthForm
            formTitle='Create account'
            fields={[
              {
                label: 'Email',
                name: 'email',
                type: 'email',
                placeholder: 'you@example.com',
                required: true
              },
              {
                label: 'Password',
                name: 'password',
                type: 'password',
                placeholder: '••••••••',
                required: true,
                onChange: setPassword,
                belowField: <PasswordChecklist password={password} />
              }
            ]}
            onSubmit={async (e) => e.preventDefault()}
          />
        </div>
      </div>
    </div>
  )
}
