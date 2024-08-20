import { PageSEO } from 'src/components/SEO'
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    async function letsGo() {
      await router.push('/words')
    }
    letsGo()
  })

  return (
    <>
      <PageSEO title="goosebumps.fm" description="Curated Music & the occasional prose" />
      {/* <Tabs /> */}
    </>
  )
}
