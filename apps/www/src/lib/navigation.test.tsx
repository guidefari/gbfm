import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Link, navigateBrowser } from './navigation'

const { astroNavigate } = vi.hoisted(() => ({
  astroNavigate: vi.fn(() => Promise.resolve())
}))

vi.mock('astro:transitions/client', () => ({ navigate: astroNavigate }))

afterEach(() => {
  vi.unstubAllGlobals()
  astroNavigate.mockClear()
})

describe('Link', () => {
  it('substitutes each placeholder once and encodes parameter values', () => {
    const markup = renderToStaticMarkup(
      <Link to='/$first/$second' params={{ first: '$second', second: 'two words' }}>
        Destination
      </Link>
    )

    expect(markup).toContain('href="/%24second/two%20words"')
  })

  it('omits nullish search values without dropping false or zero', () => {
    const markup = renderToStaticMarkup(
      <Link to='/search' search={{ absent: undefined, empty: null, enabled: false, page: 0 }}>
        Search
      </Link>
    )

    expect(markup).toContain('href="/search?enabled=false&amp;page=0"')
    expect(markup).not.toContain('absent')
    expect(markup).not.toContain('empty')
  })

  it('uses Astro client navigation for programmatic route changes', async () => {
    vi.stubGlobal('window', { location: { pathname: '/', href: 'https://goosebumps.fm/' } })

    await navigateBrowser({ to: '/shows', replace: true })

    expect(astroNavigate).toHaveBeenCalledWith('/shows', { history: 'replace' })
  })
})
