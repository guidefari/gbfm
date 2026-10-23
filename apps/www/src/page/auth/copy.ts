import { Match } from 'effect'

type AuthCopy = {
  readonly title: string
  readonly submit: string
}

export const authCopy = (action: string): AuthCopy =>
  Match.value(action).pipe(
    Match.when('sign-up', () => ({ title: 'Create your account', submit: 'Sign up' })),
    Match.when('sign-in', () => ({ title: 'Welcome back', submit: 'Sign in' })),
    Match.orElse(() => ({ title: 'Reset your password', submit: 'Continue' })),
  )
