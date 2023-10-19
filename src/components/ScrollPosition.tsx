import { useEffect } from 'react'
import { useRouter } from 'next/router'

export function ScrollPosition() {
  const router = useRouter()

  useEffect(() => {
    const handleRouteChange = () => {
      // Save scroll position when navigating to a new page
      window.sessionStorage.setItem('scrollPosition', window.scrollY.toString())
    }

    const handleLoad = () => {
      // Restore scroll position when the page is loaded
      const scrollPosition = window.sessionStorage.getItem('scrollPosition')
      if (scrollPosition) {
        window.scrollTo(0, parseInt(scrollPosition))
      }
    }

    router.events.on('routeChangeStart', handleRouteChange)
    window.addEventListener('load', handleLoad)

    return () => {
      router.events.off('routeChangeStart', handleRouteChange)
      window.removeEventListener('load', handleLoad)
    }
  }, [])

  return null
}
