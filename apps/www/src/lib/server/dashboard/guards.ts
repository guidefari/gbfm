import { error, redirect, type RequestEvent } from '@sveltejs/kit'

type Access = 'member' | 'creator' | 'admin'

export function requireDashboardAccess(
  event: Pick<RequestEvent, 'locals' | 'url'>,
  access: Access
) {
  const principal = event.locals.principal
  if (principal._tag === 'Anonymous') {
    redirect(
      303,
      `/auth/sign-in?redirect=${encodeURIComponent(event.url.pathname + event.url.search)}`
    )
  }

  switch (access) {
    case 'admin':
      if (principal.role !== 'admin') error(403, 'Administrator access required')
      break
    case 'creator':
      if (principal.role === 'user') error(403, 'Creator access required')
      break
    case 'member':
      break
  }

  return { principal }
}
