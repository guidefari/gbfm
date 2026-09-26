import { redirect } from '@sveltejs/kit'
import { Predicate } from 'effect'

import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ locals }) => {
  if (Predicate.isTagged(locals.principal, 'Authenticated')) redirect(303, '/')

  return {}
}
