import { redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ locals, url }) => {
  if (locals.principal._tag === 'Anonymous') {
    redirect(303, `/auth/sign-in?redirect=${encodeURIComponent(url.pathname + url.search)}`)
  }
  return { principal: locals.principal }
}
