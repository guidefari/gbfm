import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Disc3,
  Mail,
  Radio,
  Users
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminAccessGuard } from './_components/-AdminAccessGuard'
import {
  type AdminOverviewContentBreakdown,
  useAdminOverview
} from './-overview.data'

export const Route = createFileRoute('/admin/overview')({
  component: AdminOverviewPage
})

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function KpiCard({
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
        <CardTitle className='text-sm font-medium text-muted-foreground'>
          {title}
        </CardTitle>
        <Icon className='w-4 h-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        <div className='text-3xl font-black tracking-tight'>
          {formatCount(value)}
        </div>
        <p className='mt-2 text-sm text-muted-foreground'>{detail}</p>
      </CardContent>
    </Card>
  )
}

function ContentBreakdownCard({
  title,
  stats
}: {
  title: string
  stats: AdminOverviewContentBreakdown
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='grid grid-cols-3 gap-3 text-sm'>
        <div>
          <div className='text-muted-foreground'>Published</div>
          <div className='mt-1 text-xl font-bold'>
            {formatCount(stats.published)}
          </div>
        </div>
        <div>
          <div className='text-muted-foreground'>Drafts</div>
          <div className='mt-1 text-xl font-bold'>
            {formatCount(stats.drafts)}
          </div>
        </div>
        <div>
          <div className='text-muted-foreground'>New 7d</div>
          <div className='mt-1 text-xl font-bold'>
            {formatCount(stats.newLast7Days)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AdminOverviewPage() {
  const { data, error, isPending } = useAdminOverview()

  return (
    <AdminAccessGuard>
      <div className='container max-w-7xl py-8 mx-auto space-y-6'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <Link
              to='/admin'
              className='inline-flex items-center gap-2 mb-3 text-sm text-muted-foreground hover:text-foreground'>
              <ArrowLeft className='w-4 h-4' />
              Back to management
            </Link>
            <h1 className='text-3xl font-black tracking-tight'>
              Admin Overview
            </h1>
            <p className='mt-2 text-muted-foreground'>
              A quick read on growth, publishing, engagement, and operational
              health.
            </p>
          </div>
        </div>

        {isPending ? (
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
            {[
              'users',
              'newsletter',
              'mixes',
              'plays',
              'publishing',
              'community',
              'ops',
              'recent'
            ].map((item) => (
              <Card key={item} className='min-h-36 animate-pulse' />
            ))}
          </div>
        ) : error || !data ? (
          <Card>
            <CardContent className='py-10 text-center text-destructive'>
              {error?.message || 'Failed to load admin overview.'}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
              <KpiCard
                title='Total Users'
                value={data.highlights.totalUsers}
                detail={`${formatCount(data.highlights.newUsersLast7Days)} new in the last 7 days`}
                icon={Users}
              />
              <KpiCard
                title='Newsletter'
                value={data.highlights.newsletterSubscribers}
                detail={`${formatCount(data.highlights.newSubscribersLast30Days)} new in the last 30 days`}
                icon={Mail}
              />
              <KpiCard
                title='Published Mixes'
                value={data.highlights.publishedMixes}
                detail={`${formatCount(data.highlights.newMixesLast30Days)} new in the last 30 days`}
                icon={Disc3}
              />
              <KpiCard
                title='Total Plays'
                value={data.highlights.totalPlayCount}
                detail={`${formatCount(data.highlights.verifiedUsers)} verified users overall`}
                icon={Radio}
              />
            </div>

            <div className='grid gap-4 xl:grid-cols-[1.4fr_0.9fr]'>
              <Card>
                <CardHeader>
                  <CardTitle>Publishing Pulse</CardTitle>
                </CardHeader>
                <CardContent className='grid gap-4 md:grid-cols-2'>
                  <ContentBreakdownCard
                    title='Mixes'
                    stats={data.publishing.mixes}
                  />
                  <ContentBreakdownCard
                    title='Tracks'
                    stats={data.publishing.tracks}
                  />
                  <ContentBreakdownCard
                    title='Shows'
                    stats={data.publishing.shows}
                  />
                  <ContentBreakdownCard
                    title='Posts'
                    stats={data.publishing.posts}
                  />
                  <ContentBreakdownCard
                    title='Micros'
                    stats={data.publishing.micros}
                  />
                  <ContentBreakdownCard
                    title='Labels'
                    stats={data.publishing.labels}
                  />
                  <ContentBreakdownCard
                    title='Releases'
                    stats={data.publishing.releases}
                  />
                  <ContentBreakdownCard
                    title='Misc Audio'
                    stats={data.publishing.miscAudio}
                  />
                </CardContent>
              </Card>

              <div className='space-y-4'>
                <Card>
                  <CardHeader>
                    <CardTitle>Community Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3 text-sm'>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>
                        Verified users
                      </span>
                      <span className='font-semibold'>
                        {formatCount(data.community.users.verified)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>
                        Active sessions
                      </span>
                      <span className='font-semibold'>
                        {formatCount(data.community.sessions.active)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>Favorites</span>
                      <span className='font-semibold'>
                        {formatCount(data.community.engagement.favoritesTotal)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>
                        Show subscriptions
                      </span>
                      <span className='font-semibold'>
                        {formatCount(
                          data.community.engagement.showSubscriptionsTotal
                        )}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>
                        Admins / Editors / Creators
                      </span>
                      <span className='font-semibold'>
                        {formatCount(data.community.users.admins)} /{' '}
                        {formatCount(data.community.users.editors)} /{' '}
                        {formatCount(data.community.users.creators)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Operational Health</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3 text-sm'>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>
                        Emails failed in 7d
                      </span>
                      <span className='font-semibold'>
                        {formatCount(data.operations.emails.failedLast7Days)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>
                        Pending reminders
                      </span>
                      <span className='font-semibold'>
                        {formatCount(data.operations.reminders.pending)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>
                        Processing reminders
                      </span>
                      <span className='font-semibold'>
                        {formatCount(data.operations.reminders.processing)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>Due now</span>
                      <span className='font-semibold'>
                        {formatCount(data.operations.reminders.dueNow)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground'>Generated</span>
                      <span className='font-semibold'>
                        {formatDate(data.generatedAt)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className='grid gap-4 xl:grid-cols-3'>
              <Card>
                <CardHeader>
                  <CardTitle>Recent Content</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {data.publishing.recentContent.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className='flex items-start justify-between gap-4'>
                      <div>
                        <div className='font-medium'>{item.title}</div>
                        <div className='text-xs uppercase tracking-wide text-muted-foreground'>
                          {item.type}
                          {item.draft ? ' · draft' : ' · published'}
                        </div>
                      </div>
                      <div className='text-xs text-right text-muted-foreground'>
                        {formatDate(item.createdAt)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Mixes</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {data.publishing.topMixes.map((mix) => (
                    <div
                      key={mix.id}
                      className='flex items-start justify-between gap-4'>
                      <div>
                        <div className='font-medium'>{mix.title}</div>
                        <div className='text-xs text-muted-foreground'>
                          {mix.creators.length > 0
                            ? mix.creators.join(', ')
                            : 'No creator assigned'}
                        </div>
                      </div>
                      <div className='text-sm font-semibold'>
                        {formatCount(mix.playCount)} plays
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Email Failures</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {data.operations.emails.recentFailures.length === 0 ? (
                    <div className='text-sm text-muted-foreground'>
                      No recent failures.
                    </div>
                  ) : (
                    data.operations.emails.recentFailures.map((item) => (
                      <div key={item.id} className='flex items-start gap-3'>
                        <AlertTriangle className='w-4 h-4 mt-0.5 text-destructive' />
                        <div className='min-w-0'>
                          <div className='font-medium truncate'>
                            {item.subject}
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            {item.recipientEmail} · {item.status} ·{' '}
                            {formatDate(item.createdAt)}
                          </div>
                          {item.errorMessage && (
                            <div className='mt-1 text-xs text-muted-foreground line-clamp-2'>
                              {item.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className='grid gap-4 xl:grid-cols-2'>
              <Card>
                <CardHeader>
                  <CardTitle>Newest Users</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {data.community.recentUsers.map((item) => (
                    <div
                      key={item.id}
                      className='flex items-start justify-between gap-4'>
                      <div>
                        <div className='font-medium'>{item.name}</div>
                        <div className='text-xs text-muted-foreground'>
                          {item.email} · {item.role}
                          {item.emailVerified ? ' · verified' : ' · unverified'}
                        </div>
                      </div>
                      <div className='inline-flex items-center gap-1 text-xs text-muted-foreground'>
                        <Clock3 className='w-3 h-3' />
                        {formatDate(item.createdAt)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Newest Subscribers</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {data.community.recentSubscribers.map((item) => (
                    <div
                      key={item.id}
                      className='flex items-start justify-between gap-4'>
                      <div>
                        <div className='font-medium'>{item.email}</div>
                        <div className='text-xs text-muted-foreground'>
                          {item.source || 'Unknown source'}
                        </div>
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {formatDate(item.createdAt)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminAccessGuard>
  )
}
