import { Button, Card, CardContent, CardHeader, CardTitle } from '@gbfm/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChartColumn, FileText, Mail, Radio, Shield, Users } from 'lucide-react'
import { AdminPage } from './_components/-AdminLayout'
import { useAdminOverview } from './-overview.data'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard
})

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon
}: {
  title: string
  value: number
  detail: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-base font-medium text-muted-foreground'>{title}</CardTitle>
        <Icon className='h-4 w-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        <div className='text-3xl font-black tracking-tight'>{formatCount(value)}</div>
        <p className='mt-2 text-base text-muted-foreground'>{detail}</p>
      </CardContent>
    </Card>
  )
}

function AdminDashboard() {
  const { data, error, isPending } = useAdminOverview()

  return (
    <AdminPage
      title='Admin Dashboard'
      description='A route-first control center for publishing, operations, subscribers, and platform maintenance.'
      actions={
        <>
          <Button asChild variant='outline'>
            <Link to='/admin/overview'>Full overview</Link>
          </Button>
          <Button asChild variant='outline'>
            <Link to='/admin/music'>Music catalog</Link>
          </Button>
          <Button asChild variant='outline'>
            <Link to='/admin/frontend-errors'>Frontend errors</Link>
          </Button>
        </>
      }>
      {isPending ? (
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {['a', 'b', 'c', 'd'].map((item) => (
            <Card key={item} className='min-h-36 animate-pulse' />
          ))}
        </div>
      ) : error || !data ? (
        <Card>
          <CardContent className='py-10 text-center text-destructive'>
            {error?.message || 'Failed to load admin dashboard overview.'}
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          <MetricCard
            title='Users'
            value={data.highlights.totalUsers}
            detail={`${formatCount(data.highlights.newUsersLast7Days)} new in 7 days`}
            icon={Users}
          />
          <MetricCard
            title='Subscribers'
            value={data.highlights.newsletterSubscribers}
            detail={`${formatCount(data.highlights.newSubscribersLast30Days)} new in 30 days`}
            icon={Mail}
          />
          <MetricCard
            title='Published mixes'
            value={data.highlights.publishedMixes}
            detail={`${formatCount(data.highlights.newMixesLast30Days)} new in 30 days`}
            icon={Radio}
          />
          <MetricCard
            title='Total plays'
            value={data.highlights.totalPlayCount}
            detail={`${formatCount(data.community.sessions.active)} active sessions right now`}
            icon={ChartColumn}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What changed</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4 text-base md:grid-cols-3'>
          <div className='flex items-start gap-3'>
            <Users className='mt-0.5 h-4 w-4 text-muted-foreground' />
            <div>
              <div className='font-medium'>User operations</div>
              <p className='text-muted-foreground'>
                Account management now has a dedicated route instead of being buried behind tabs.
              </p>
            </div>
          </div>
          <div className='flex items-start gap-3'>
            <FileText className='mt-0.5 h-4 w-4 text-muted-foreground' />
            <div>
              <div className='font-medium'>Publishing flow</div>
              <p className='text-muted-foreground'>
                Content, shows, newsletter, and file tools each have direct URLs for linking and
                revisitability.
              </p>
            </div>
          </div>
          <div className='flex items-start gap-3'>
            <Shield className='mt-0.5 h-4 w-4 text-muted-foreground' />
            <div>
              <div className='font-medium'>Admin ergonomics</div>
              <p className='text-muted-foreground'>
                A persistent sidebar carries routing while the heavy tools stay in focused pages.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </AdminPage>
  )
}
