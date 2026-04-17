import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'
import { ContentTab } from './_components/-ContentTab'
import { EmailLogsTab } from './_components/-EmailLogsTab'
import { FilesTab } from './_components/-FilesTab'
import { SessionsTab } from './_components/-SessionsTab'
import { ShowsTab } from './_components/-ShowsTab'
import { UsersTab } from './_components/-UsersTab'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard
})

function AdminDashboard() {
  return (
    <AdminAccessGuard>
      <div className='container max-w-6xl py-8 mx-auto'>
        <div className='flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-bold'>Admin Dashboard</h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              Direct management tools for users, content, shows, sessions,
              email, and files.
            </p>
          </div>
          <Button asChild variant='outline'>
            <Link to='/admin/overview'>
              View overview
              <ArrowRight className='w-4 h-4 ml-2' />
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue='users'>
              <TabsList className='mb-4'>
                <TabsTrigger value='users'>Users</TabsTrigger>
                <TabsTrigger value='content'>Content</TabsTrigger>
                <TabsTrigger value='shows'>Shows</TabsTrigger>
                <TabsTrigger value='sessions'>Sessions</TabsTrigger>
                <TabsTrigger value='email-logs'>Email Logs</TabsTrigger>
                <TabsTrigger value='files'>Files</TabsTrigger>
              </TabsList>

              <TabsContent value='users'>
                <UsersTab />
              </TabsContent>

              <TabsContent value='content'>
                <ContentTab />
              </TabsContent>

              <TabsContent value='shows'>
                <ShowsTab />
              </TabsContent>

              <TabsContent value='sessions'>
                <SessionsTab />
              </TabsContent>

              <TabsContent value='email-logs'>
                <EmailLogsTab />
              </TabsContent>

              <TabsContent value='files'>
                <FilesTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AdminAccessGuard>
  )
}
