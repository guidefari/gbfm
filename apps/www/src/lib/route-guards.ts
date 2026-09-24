import { redirect } from '@/lib/page'

export const signInRedirect = (href: string) =>
  redirect({
    to: '/auth/sign-in',
    search: { redirect: href }
  })
