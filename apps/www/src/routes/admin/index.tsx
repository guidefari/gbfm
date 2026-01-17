import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/store/auth'
import { ContentTab } from './_components/ContentTab'
import { SessionsTab } from './_components/SessionsTab'
import { UsersTab } from './_components/UsersTab'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard
})

function AdminDashboard() {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className='flex items-center justify-center min-h-screen p-4'>
        <div className='text-center'>
          <p className='text-lg text-gray-600 mb-4'>
            {!isAuthenticated
              ? 'Please sign in to access the admin dashboard'
              : 'You need admin privileges to access this page'}
          </p>
          <a
            href={isAuthenticated ? '/' : '/auth/sign-in'}
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90'>
            {isAuthenticated ? 'Go Home' : 'Sign In'}
          </a>
        </div>
      </div>
    )
  }

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
