import { Link } from '@tanstack/react-router'

export function TermsConsent() {
  return (
    <p className='text-xs text-muted-foreground'>
      By creating an account, you agree to our{' '}
      <Link
        to='/terms'
        className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight'>
        Terms
      </Link>{' '}
      and{' '}
      <Link
        to='/privacy'
        className='font-medium text-gb-pastel-green-1 underline-offset-4 hover:text-gb-highlight'>
        Privacy Policy
      </Link>
      .
    </p>
  )
}
