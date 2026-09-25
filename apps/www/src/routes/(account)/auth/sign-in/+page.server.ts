import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ locals }) => {
  if (locals.principal._tag === 'Authenticated') redirect(303, '/')
  return {}
}
