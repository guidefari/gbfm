import Link from '@/components/CustomLink'
import { PageSEO } from '@/components/SEO'
import { SuperHero } from '../components/FrontPage/SuperHero'
import Layout from '../components/Layout'

export default function Index() {
  return (
    <Layout>
      <PageSEO title="goosebumps dot fm" description={'Curated Music & the occasional prose'} />
      <SuperHero />
      <Link href="curated" as="curated">
        <h3 className="title">-Prose</h3>
      </Link>
      <Link href="tweets" as="tweets">
        <h3 className="title">-Tweets</h3>
      </Link>
    </Layout>
  )
}
