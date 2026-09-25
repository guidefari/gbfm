import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ locals }) => ({
  principal: locals.principal,
  requestId: locals.requestId
})
