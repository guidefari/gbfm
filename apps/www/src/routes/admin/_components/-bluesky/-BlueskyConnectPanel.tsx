import { Button, Input, Label } from '@gbfm/ui'
import { ExternalLink } from 'lucide-react'
import { useState } from 'react'

export function BlueskyConnectPanel({
  onConnect,
  isPending,
  error
}: {
  onConnect: (input: { handle: string; appPassword: string }) => void
  isPending: boolean
  error: string | null
}) {
  const [handle, setHandle] = useState('')
  const [appPassword, setAppPassword] = useState('')

  return (
    <div className='rounded-sm border border-border p-6'>
      <div className='max-w-md space-y-1'>
        <h2 className='text-lg font-medium'>Connect Bluesky</h2>
        <p className='text-sm text-muted-foreground'>
          Import your music posts as Goosebumps drafts. Use an app password, not your account
          password.
        </p>
      </div>

      <form
        className='mt-6 max-w-md space-y-4'
        onSubmit={(event) => {
          event.preventDefault()
          onConnect({ handle: handle.trim(), appPassword })
        }}>
        <div className='space-y-2'>
          <Label htmlFor='bluesky-handle'>Handle</Label>
          <Input
            id='bluesky-handle'
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder='handle.bsky.social'
            required
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='bluesky-app-password'>App password</Label>
          <Input
            id='bluesky-app-password'
            type='password'
            value={appPassword}
            onChange={(event) => setAppPassword(event.target.value)}
            placeholder='xxxx-xxxx-xxxx-xxxx'
            required
          />
          <a
            href='https://bsky.app/settings/app-passwords'
            target='_blank'
            rel='noreferrer'
            className='inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground'>
            Create one in Bluesky settings
            <ExternalLink className='size-3' />
          </a>
        </div>
        {error ? <p className='text-sm text-destructive'>{error}</p> : null}
        <Button type='submit' disabled={isPending || !handle.trim() || !appPassword}>
          {isPending ? 'Connecting…' : 'Connect account'}
        </Button>
      </form>
    </div>
  )
}
