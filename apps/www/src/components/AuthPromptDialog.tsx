import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label
} from '@gbfm/ui'
import { Heart, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { signIn, signUp } from '@/lib/auth-client'
import { useAuthPromptStore } from '@/store/authPrompt'

type AuthMode = 'choice' | 'sign-in' | 'sign-up'

export function AuthPromptDialog() {
  const { isOpen, contentType, onAuthSuccess, close } = useAuthPromptStore()
  const [mode, setMode] = useState<AuthMode>('choice')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setMode('choice')
      setError('')
      close()
    }
  }

  const handleAuthSuccess = () => {
    handleClose(false)
    onAuthSuccess?.()
  }

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)
    const identifier = formData.get('identifier') as string
    const password = formData.get('password') as string

    try {
      const isEmail = identifier.includes('@')
      const result = isEmail
        ? await signIn.email({ email: identifier, password })
        : await signIn.username({ username: identifier, password })

      if (result.data) {
        handleAuthSuccess()
      } else if (result.error) {
        setError(result.error.message || 'Failed to sign in')
      }
    } catch {
      setError('Failed to sign in')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const name = formData.get('name') as string
    const username = formData.get('username') as string

    try {
      const result = await signUp.email({
        email,
        password,
        name,
        username
      })

      if (result.data) {
        handleAuthSuccess()
      } else if (result.error) {
        setError(result.error.message || 'Failed to sign up')
      }
    } catch {
      setError('Failed to sign up')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <div className='flex items-center justify-center w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10'>
            <Heart className='w-6 h-6 text-primary' />
          </div>
          <DialogTitle className='text-center'>
            {mode === 'choice' && 'Sign in to save favorites'}
            {mode === 'sign-in' && 'Sign In'}
            {mode === 'sign-up' && 'Create Account'}
          </DialogTitle>
          {mode === 'choice' && (
            <DialogDescription className='text-center'>
              Create an account or sign in to save your favorite{' '}
              {contentType === 'show' ? 'shows' : 'mixes'} and get notified
              about new releases.
            </DialogDescription>
          )}
        </DialogHeader>

        {error && (
          <div className='p-3 text-sm text-red-700 bg-red-100 rounded-md'>
            {error}
          </div>
        )}

        {mode === 'choice' && (
          <div className='flex flex-col gap-2'>
            <Button onClick={() => setMode('sign-in')} className='w-full'>
              Sign in
            </Button>
            <Button
              onClick={() => setMode('sign-up')}
              variant='outline'
              className='w-full'>
              Create account
            </Button>
          </div>
        )}

        {mode === 'sign-in' && (
          <form onSubmit={handleSignIn} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='identifier'>Email or Username</Label>
              <Input
                id='identifier'
                name='identifier'
                type='text'
                placeholder='name@example.com or username'
                required
                autoComplete='email'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='password'>Password</Label>
              <Input
                id='password'
                name='password'
                type='password'
                placeholder='Enter your password'
                required
                autoComplete='current-password'
              />
            </div>
            <div className='flex flex-col gap-2'>
              <Button type='submit' disabled={isLoading} className='w-full'>
                {isLoading ? (
                  <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                ) : null}
                Sign In
              </Button>
              <Button
                type='button'
                variant='ghost'
                onClick={() => {
                  setMode('choice')
                  setError('')
                }}
                className='w-full'>
                Back
              </Button>
            </div>
            <p className='text-sm text-center text-muted-foreground'>
              Don't have an account?{' '}
              <button
                type='button'
                onClick={() => {
                  setMode('sign-up')
                  setError('')
                }}
                className='underline hover:text-foreground'>
                Sign up
              </button>
            </p>
          </form>
        )}

        {mode === 'sign-up' && (
          <form onSubmit={handleSignUp} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                name='email'
                type='email'
                placeholder='name@example.com'
                required
                autoComplete='email'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='name'>Name</Label>
              <Input
                id='name'
                name='name'
                type='text'
                placeholder='Enter your name'
                required
                autoComplete='name'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='username'>Username</Label>
              <Input
                id='username'
                name='username'
                type='text'
                placeholder='Choose a username'
                required
                autoComplete='username'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='signup-password'>Password</Label>
              <Input
                id='signup-password'
                name='password'
                type='password'
                placeholder='Enter your password'
                required
                autoComplete='new-password'
              />
            </div>
            <div className='flex flex-col gap-2'>
              <Button type='submit' disabled={isLoading} className='w-full'>
                {isLoading ? (
                  <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                ) : null}
                Create Account
              </Button>
              <Button
                type='button'
                variant='ghost'
                onClick={() => {
                  setMode('choice')
                  setError('')
                }}
                className='w-full'>
                Back
              </Button>
            </div>
            <p className='text-sm text-center text-muted-foreground'>
              Already have an account?{' '}
              <button
                type='button'
                onClick={() => {
                  setMode('sign-in')
                  setError('')
                }}
                className='underline hover:text-foreground'>
                Sign in
              </button>
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
