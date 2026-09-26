import { hasMinRole } from '@gbfm/core/roles'
import { error, redirect } from '@sveltejs/kit'
import { Predicate } from 'effect'

import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ locals, url }) => {
  if (!Predicate.isTagged(locals.principal, 'Authenticated')) {
    redirect(303, `/auth/sign-in?redirect=${encodeURIComponent(url.pathname + url.search)}`)
  }

  if (!hasMinRole(locals.principal.role, 'creator')) error(403, 'Creator access required')

  return { principal: locals.principal }
}
