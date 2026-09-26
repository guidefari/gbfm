import { hasMinRole } from '@gbfm/core/roles'
import { error, redirect, type RequestEvent } from '@sveltejs/kit'
import { Match } from 'effect'

type Access = 'member' | 'creator' | 'admin'

export function requireDashboardAccess(
  event: Pick<RequestEvent, 'locals' | 'url'>,
  access: Access,
) {
  const principal = event.locals.principal

  const authenticated = Match.value(principal).pipe(
    Match.tag('Anonymous', () =>
      redirect(
        303,
        `/auth/sign-in?redirect=${encodeURIComponent(event.url.pathname + event.url.search)}`,
      ),
    ),
    Match.tag('Authenticated', (value) => value),
    Match.exhaustive,
  )

  switch (access) {
    case 'admin':
      if (authenticated.role !== 'admin') error(403, 'Administrator access required')
      break
    case 'creator':
      if (!hasMinRole(authenticated.role, 'creator')) error(403, 'Creator access required')
      break
    case 'member':
      break
  }

  return { principal: authenticated }
}
