import Link from '@/components/CustomLink'
import { PageSEO } from '@/components/SEO'
import { SuperHero } from '../components/FrontPage/SuperHero'
import Layout from '../components/Layout'

export default function Index() {
  return (
    <Layout>
      <PageSEO title="goosebumps.fm" description={'Curated Music & the occasional prose'} />
      <SuperHero />
      <ul className="max-w-full">
        <li className="title">
          <Link href="curated" as="curated">
            Curated Sounds & Prose
          </Link>
        </li>
        <li className="title">
          <Link href="labels" as="labels">
            Record Labels I like
          </Link>
        </li>
        <li className="title">
          <Link href="tweets" as="tweets">
            Archived Tweets
          </Link>
        </li>
      </ul>
    </Layout>
  )
}
