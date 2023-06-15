import Link from 'src/components/CustomLink'
import { PageSEO } from 'src/components/SEO'
import { SuperHero } from '../components/FrontPage/SuperHero'
import { Content } from '../components/FrontPage/Content'

export default function Index() {
  return (
    <>
      <PageSEO title="goosebumps.fm" description="Curated Music & the occasional prose" />
      <SuperHero />
      <Content />
    </>
  )
}
