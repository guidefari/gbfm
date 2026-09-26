import { redirect } from '@sveltejs/kit'

import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ url }) => {
  const edit = url.searchParams.get('edit')
  redirect(308, `/new?mode=editorial${edit ? `&edit=${encodeURIComponent(edit)}` : ''}`)
}
