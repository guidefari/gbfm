import { redirect } from '@tanstack/react-router'

export const signInRedirect = (href: string) =>
  redirect({
    to: '/auth/sign-in',
    search: { redirect: href }
  })
