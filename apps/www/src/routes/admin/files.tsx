import { Card, CardContent } from '@gbfm/ui'
import { createFileRoute } from '@tanstack/react-router'
import { FilesTab } from './_components/-FilesTab'
import { AdminPage } from './_components/-AdminLayout'

export const Route = createFileRoute('/admin/files')({
  component: AdminFilesPage
})

function AdminFilesPage() {
  return (
    <AdminPage
      title='Files'
      description='Inspect storage buckets, compare object presence, and copy assets between buckets.'
      backToAdmin>
      <Card>
        <CardContent className='pt-6'>
          <FilesTab />
        </CardContent>
      </Card>
    </AdminPage>
  )
}
