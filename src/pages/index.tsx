import { PageSEO } from 'src/components/SEO'
import { Tabs } from '@/components/FrontPage/Tabs'

export default function Index() {
  return (
    <>
      <PageSEO title="goosebumps.fm" description="Curated Music & the occasional prose" />
      <Tabs />
    </>
  )
}
