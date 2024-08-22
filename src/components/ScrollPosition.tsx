// where AI failed, this came in handy https://aabishkar.info.np/blogs/how-to-restore-the-scroll-position-in-nextjs
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export function ScrollPosition() {
  const router = useRouter()

  // set scroll restoration to manual
  useEffect(() => {
    if ('scrollRestoration' in history && history.scrollRestoration !== 'manual') {
      history.scrollRestoration = 'manual'
    }
  }, [])

  // handle and store scroll position
  useEffect(() => {
    const handleRouteChange = () => {
      sessionStorage.setItem('scrollPosition', window.scrollY.toString())
    }
    router.events.on('routeChangeStart', handleRouteChange)
    return () => {
      router.events.off('routeChangeStart', handleRouteChange)
    }
  }, [router.events])

  // restore scroll position
  useEffect(() => {
    if ('scrollPosition' in sessionStorage) {
      window.scrollTo(0, Number(sessionStorage.getItem('scrollPosition')))
      sessionStorage.removeItem('scrollPosition')
    }
  }, [])

  return null
}
