import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ locals }) => ({ principal: locals.principal })
