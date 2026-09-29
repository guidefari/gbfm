import { Effect } from 'effect'

import { Route } from '../../route'
import { apiRequest } from '../../server/api'
import { parseDashboardDocument } from './document'
import { endpointFor, isAdminSection } from './model'

export const loadDashboardData = async (
  request: Request,
  route: Route,
  url: URL,
  principal: { readonly role: string | null } | null,
) => {
  const path =
    Route.guards.Dashboard(route) &&
    principal &&
    (!isAdminSection(route.section) || principal.role === 'admin')
      ? endpointFor(route.section, url.searchParams)
      : null

  return path
    ? apiRequest(request, path, { method: 'GET' })
        .then(async (response) =>
          response.ok
            ? Effect.runPromise(parseDashboardDocument(path, await response.json()))
            : null,
        )
        .catch(() => null)
    : null
}
