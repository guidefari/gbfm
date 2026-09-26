import { redirect } from '@sveltejs/kit'
import { Predicate } from 'effect'

import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ locals, url }) => {
  if (Predicate.isTagged(locals.principal, 'Anonymous')) {
    redirect(303, `/auth/sign-in?redirect=${encodeURIComponent(url.pathname + url.search)}`)
  }

  return { principal: locals.principal }
}
