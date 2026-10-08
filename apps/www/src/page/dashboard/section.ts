import { entityRoute, tabs } from './page/catalog'

const adminSections = new Set([
  'admin',
  'users',
  'sessions',
  'shows',
  'music',
  'playlists',
  'search',
  'newsletter',
  'email-logs',
  'frontend-errors',
  'all/mixes',
  'featured-mix',
  'all/tweets',
  'all/editorial',
])

export const isAdminSection = (section: string) =>
  adminSections.has(section) || section.startsWith('music-entity/')

export const endpointFor = (section: string, query = new URLSearchParams()) => {
  const entity = entityRoute(section)

  if (entity) return entity.path

  if (section === 'music') {
    const tab = tabs.find((tab) => tab === query.get('tab')) ?? 'artists'

    return `/api/music/${tab}${tab === 'labels' ? '/manage' : ''}`
  }

  if (section === 'users') {
    const offset = Number(query.get('offset') ?? '0')

    const params = new URLSearchParams({
      limit: '25',
      offset: String(Number.isSafeInteger(offset) && offset >= 0 ? offset : 0),
    })

    const search = query.get('search')?.trim()

    if (search) {
      params.set('searchField', 'email')
      params.set('searchValue', search)
    }

    return `/auth/admin/list-users?${params}`
  }

  const endpoints = new Map(
    Object.entries({
      overview: '/api/favorites?limit=25&offset=0',
      admin: '/api/admin/overview',
      'featured-mix': '/api/admin/featured-mix',
      profile: '/api/user/profile',
      email: '/api/user/email-preferences',
      favorites: '/api/favorites?limit=25&offset=0',
      reminders: '/api/music-reminders',
      'content/mixes': '/api/content/audio/mix/manage?limit=25&offset=0',
      'content/tweets': '/api/content/posts/manage?type=micro&limit=25&offset=0',
      'content/editorial': '/api/content/posts/manage?type=post&limit=25&offset=0',
      'all/mixes': '/api/content/audio/mix/manage?limit=25&offset=0',
      'all/tweets': '/api/content/posts/manage?type=micro&limit=25&offset=0',
      'all/editorial': '/api/content/posts/manage?type=post&limit=25&offset=0',
      shows: '/api/shows/manage?limit=25&offset=0',
      music: '/api/music/artists',
      playlists: '/api/music/playlists',
      newsletter: '/api/admin/newsletter-subscribers',
      'email-logs': '/api/email/logs?limit=50&offset=0',
      'frontend-errors': '/api/admin/telemetry',
      search: '/api/search?q=',
    }),
  )

  return endpoints.get(section) ?? null
}
