import { PageSEO } from 'src/components/SEO'
import { SuperHero } from '../components/FrontPage/SuperHero'
import { Content } from '../components/FrontPage/Content'
import Curated from '@/components/Curated'

export default function Index() {
  return (
    <>
      <PageSEO title="goosebumps.fm" description="Curated Music & the occasional prose" />
      <div className="min-h-[100dvh]">
        <SuperHero />
        <Content />
      </div>
      <Curated />
    </>
  )
}
