import { createFileRoute, redirect } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContentTab } from './_components/ContentTab'
import { SessionsTab } from './_components/SessionsTab'
import { UsersTab } from './_components/UsersTab'

export const Route = createFileRoute('/admin/')({
  beforeLoad: ({ context }) => {
    console.log('context:', context)
    if (!context.auth.isAuthenticated || context.auth.user?.role !== 'admin') {
      throw redirect({
        to: '/'
      })
    }
  },
  component: AdminDashboard
})

function AdminDashboard() {
  return (
    <div className='container mx-auto max-w-6xl py-8'>
      <h1 className='mb-6 text-2xl font-bold'>Admin Dashboard</h1>

      <Card>
        <CardHeader>
          <CardTitle>Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue='users'>
            <TabsList className='mb-4'>
              <TabsTrigger value='users'>Users</TabsTrigger>
              <TabsTrigger value='content'>Content</TabsTrigger>
              <TabsTrigger value='sessions'>Sessions</TabsTrigger>
            </TabsList>

            <TabsContent value='users'>
              <UsersTab />
            </TabsContent>

            <TabsContent value='content'>
              <ContentTab />
            </TabsContent>

            <TabsContent value='sessions'>
              <SessionsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
