import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export function ScrollPosition() {
  const router = useRouter()

  useEffect(() => {
    // Save scroll position when navigating to a new page
    const handleRouteChange = () => {
      sessionStorage.setItem('scrollPosition', window.scrollY.toString())
    }

    // Restore scroll position when the page is loaded
    const handleLoad = () => {
      const scrollPosition = sessionStorage.getItem('scrollPosition')
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

  return (
    <>
      <Head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                const scrollPosition = sessionStorage.getItem('scrollPosition');
                if (scrollPosition) {
                  window.scrollTo(0, parseInt(scrollPosition));
                }
              }
            `,
          }}
        />
      </Head>
    </>
  )
}
