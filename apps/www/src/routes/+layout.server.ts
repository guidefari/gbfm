import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ locals, platform }) => ({
  principal: locals.principal,
  requestId: locals.requestId,
  release: platform?.env.APP_RELEASE ?? 'local',
})
