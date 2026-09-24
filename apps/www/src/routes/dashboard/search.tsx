import { Card, CardContent } from '@gbfm/ui'
import { createPageComponent } from '@/components/PageApp'
import { createFileRoute } from '@/lib/page'
import { AdminPage } from './_components/-AdminLayout'
import { SearchTab } from './_components/-SearchTab'

export const Route = createFileRoute('/dashboard/search')({
  component: AdminSearchPage
})

export const Page = createPageComponent(Route)

function AdminSearchPage() {
  return (
    <AdminPage
      title='Search'
      description='Test the content search endpoint across shows, audio, and posts.'
      backToAdmin>
      <Card>
        <CardContent className='pt-6'>
          <SearchTab />
        </CardContent>
      </Card>
    </AdminPage>
  )
}
