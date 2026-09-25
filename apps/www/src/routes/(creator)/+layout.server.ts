import { error, redirect } from '@sveltejs/kit'
import { Predicate } from 'effect'

import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ locals, url }) => {
  if (Predicate.isTagged(locals.principal, 'Anonymous')) {
    redirect(303, `/auth/sign-in?redirect=${encodeURIComponent(url.pathname + url.search)}`)
  }

  if (!['creator', 'editor', 'admin'].includes(locals.principal.role))
    error(403, 'Creator access required')

  return { principal: locals.principal }
}
