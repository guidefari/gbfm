import { describe, expect, test } from 'vitest'
import { navigationRoute } from './navigation-telemetry'

describe('navigation telemetry route names', () => {
  test('bounds dynamic route cardinality without obscuring static routes', () => {
    const route = (path: string) => navigationRoute(new URL(path, 'https://goosebumps.fm'))

    expect(route('/')).toBe('/')
    expect(route('/shows')).toBe('/shows')
    expect(route('/shows/farendradio')).toBe('/shows/:slug')
    expect(route('/?show=farendradio')).toBe('/?show=:slug')
    expect(route('/tweet/the-polyrhythms-in-this-track')).toBe('/tweet/:slug')
    expect(route('/tweet/latest')).toBe('/tweet/latest')
    expect(route('/tags/jazz')).toBe('/tags/:slug')
    expect(route('/a-short-link')).toBe('/:slug')
    expect(route('/unknown/private-value')).toBe('/:path')
    expect(route('/dashboard/content/tweets')).toBe('/dashboard/content/tweets')
    expect(route('/dashboard/music-entity/track/secret-id')).toBe(
      '/dashboard/music-entity/:entityType/:id'
    )
  })
})
