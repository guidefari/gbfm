import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import { Disc3, FileText, MailPlus, Radio, Rss } from 'lucide-react'
import { type ComponentType, useMemo, useState } from 'react'
import { useAdminNewsletterSubscribers } from '@/lib/http'
import { useAdminOverview } from '../-overview.data'

type CampaignAsset = {
  id: string
  slug: string
  title: string
  type: 'mix' | 'show' | 'post' | 'release'
  createdAt: string
}

function isCampaignAssetType(type: string): type is CampaignAsset['type'] {
  return ['mix', 'show', 'post', 'release'].includes(type)
}

const assetLabels: Record<CampaignAsset['type'], string> = {
  mix: 'Mix',
  show: 'Show',
  post: 'Editorial',
  release: 'Release'
}

const assetIcons = {
  mix: Disc3,
  show: Radio,
  post: FileText,
  release: Rss
} satisfies Record<CampaignAsset['type'], ComponentType<{ className?: string }>>

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function NewsletterTab() {
  const { data, isPending, isError } = useAdminNewsletterSubscribers()
  const overview = useAdminOverview()
  const campaignAssets = useMemo<CampaignAsset[]>(() => {
    const items = overview.data?.publishing.recentContent ?? []

    return items
      .flatMap((item) => {
        if (item.draft || !isCampaignAssetType(item.type)) return []

        const asset: CampaignAsset = {
          id: item.id,
          slug: item.slug,
          title: item.title ?? item.slug,
          type: item.type,
          createdAt: item.createdAt
        }

        return [asset]
      })
      .slice(0, 6)
  }, [overview.data])
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const selectedAsset =
    campaignAssets.find((item) => item.id === selectedAssetId) ?? campaignAssets[0] ?? null
  const [campaignName, setCampaignName] = useState('Weekly subscribers note')
  const [subject, setSubject] = useState('')
  const [angle, setAngle] = useState(
    'Lead with one hero drop, then stack a short editor note and one supporting link.'
  )

  if (isPending) {
    return <p className='text-sm text-muted-foreground'>Loading...</p>
  }

  if (isError) {
    return <p className='text-sm text-destructive'>Failed to load subscribers.</p>
  }

  const subscribers = data?.subscribers ?? []
  const activeSubscribers = subscribers.filter((sub) => !sub.unsubscribedAt)
  const unsubscribedCount = subscribers.length - activeSubscribers.length
  const newLast30Days = overview.data?.community.newsletter.newLast30Days ?? 0
  const recentSubscribers = overview.data?.community.recentSubscribers.slice(0, 5) ?? []
  const suggestedSubject =
    selectedAsset &&
    `${assetLabels[selectedAsset.type]} drop: ${selectedAsset.title.length > 56 ? `${selectedAsset.title.slice(0, 56)}...` : selectedAsset.title}`
  const previewSubject = subject || suggestedSubject || 'Subject line still to be written'
  const previewCta =
    selectedAsset?.type === 'post'
      ? 'Read the full piece'
      : selectedAsset?.type === 'show'
        ? 'Open the show page'
        : selectedAsset?.type === 'release'
          ? 'Explore the release'
          : 'Listen now'
  const previewHref = selectedAsset
    ? selectedAsset.type === 'post'
      ? `/editorial/${selectedAsset.slug}`
      : selectedAsset.type === 'show'
        ? `/shows/${selectedAsset.slug}`
        : selectedAsset.type === 'release'
          ? `/releases/${selectedAsset.slug}`
          : `/mixes/${selectedAsset.slug}`
    : null

  return (
    <div className='space-y-6'>
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Active subscribers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-black tracking-tight'>
              {formatCount(activeSubscribers.length)}
            </div>
            <p className='mt-2 text-sm text-muted-foreground'>
              Audience currently able to receive sends.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>New in 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-black tracking-tight'>{formatCount(newLast30Days)}</div>
            <p className='mt-2 text-sm text-muted-foreground'>
              Recent list growth from the existing funnel.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Unsubscribed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-black tracking-tight'>
              {formatCount(unsubscribedCount)}
            </div>
            <p className='mt-2 text-sm text-muted-foreground'>
              Useful for measuring churn once campaigns land.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm text-muted-foreground'>Send-ready content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-black tracking-tight'>
              {formatCount(campaignAssets.length)}
            </div>
            <p className='mt-2 text-sm text-muted-foreground'>
              Published assets pulled from recent mixes, shows, editorials, and releases.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 xl:grid-cols-[1.35fr_0.95fr]'>
        <Card>
          <CardHeader>
            <CardTitle>Basic CMS Shape</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <p className='text-sm text-muted-foreground'>
              First pass for a subscriber dashboard: pick a published asset, shape the email angle,
              and use the current content tools as the source of truth.
            </p>

            <div className='flex flex-wrap gap-2'>
              <Button asChild size='sm'>
                <Link to='/new/editorial' search={{ edit: undefined }}>
                  New editorial
                </Link>
              </Button>
              <Button asChild size='sm' variant='outline'>
                <Link to='/mix-upload'>Upload mix</Link>
              </Button>
              <Button asChild size='sm' variant='outline'>
                <Link to='/admin/overview'>View content pulse</Link>
              </Button>
            </div>

            <div className='grid gap-3 md:grid-cols-2'>
              {campaignAssets.map((asset) => {
                const Icon = assetIcons[asset.type]
                const isSelected = selectedAsset?.id === asset.id

                return (
                  <button
                    key={asset.id}
                    type='button'
                    onClick={() => setSelectedAssetId(asset.id)}
                    className={`rounded-lg border p-4 text-left transition ${
                      isSelected ? 'border-foreground bg-muted/50' : 'hover:bg-muted/40'
                    }`}>
                    <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                      <Icon className='h-4 w-4' />
                      <span>{assetLabels[asset.type]}</span>
                      <span>•</span>
                      <span>{formatDate(asset.createdAt)}</span>
                    </div>
                    <div className='mt-2 font-semibold'>{asset.title}</div>
                    <div className='mt-1 text-sm text-muted-foreground'>/{asset.slug}</div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Draft Broadcast</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Campaign</label>
              <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Subject line</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={
                  suggestedSubject ?? 'Choose a content item to generate a starting point'
                }
              />
            </div>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Angle / editor note</label>
              <Textarea value={angle} onChange={(e) => setAngle(e.target.value)} />
            </div>

            <div className='rounded-lg border bg-muted/30 p-4'>
              <div className='flex items-center gap-2 text-sm font-medium'>
                <MailPlus className='h-4 w-4' />
                Preview shape
              </div>
              <div className='mt-3 space-y-2 text-sm'>
                <p>
                  <span className='text-muted-foreground'>Subject:</span> {previewSubject}
                </p>
                <p>
                  <span className='text-muted-foreground'>Lead:</span> {angle}
                </p>
                <p>
                  <span className='text-muted-foreground'>Primary CTA:</span> {previewCta}
                  {previewHref ? ` -> ${previewHref}` : ''}
                </p>
              </div>
            </div>

            <div className='space-y-2 text-sm'>
              <div className='font-medium'>Scoped next steps</div>
              <ul className='space-y-2 text-muted-foreground'>
                <li>1. Persist campaign drafts and content selections in the API.</li>
                <li>2. Add segmenting by source, recency, and subscription state.</li>
                <li>3. Wire send/test-send flows into email delivery logs.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 xl:grid-cols-[1.1fr_1.4fr]'>
        <Card>
          <CardHeader>
            <CardTitle>Recent Subscriber Activity</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {overview.isPending ? (
              <p className='text-sm text-muted-foreground'>Loading subscriber activity...</p>
            ) : overview.isError ? (
              <p className='text-sm text-destructive'>Failed to load subscriber activity.</p>
            ) : recentSubscribers.length === 0 ? (
              <p className='text-sm text-muted-foreground'>No recent subscriber activity yet.</p>
            ) : (
              recentSubscribers.map((sub) => (
                <div
                  key={sub.id}
                  className='flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0'>
                  <div className='min-w-0'>
                    <div className='truncate font-medium'>{sub.email}</div>
                    <div className='text-sm text-muted-foreground'>
                      {sub.source ?? 'unknown source'}
                    </div>
                  </div>
                  <div className='shrink-0 text-sm text-muted-foreground'>
                    {formatDate(sub.createdAt)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Audience table
              <span className='ml-2 text-sm font-normal text-muted-foreground'>
                {subscribers.length} subscriber{subscribers.length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b text-left text-muted-foreground'>
                    <th className='pb-2 pr-4 font-medium'>Email</th>
                    <th className='pb-2 pr-4 font-medium'>Name</th>
                    <th className='pb-2 pr-4 font-medium'>Source</th>
                    <th className='pb-2 pr-4 font-medium'>Status</th>
                    <th className='pb-2 font-medium'>Subscribed</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((sub) => (
                    <tr key={sub.id} className='border-b last:border-0'>
                      <td className='py-2 pr-4'>{sub.email}</td>
                      <td className='py-2 pr-4 text-muted-foreground'>{sub.name ?? '-'}</td>
                      <td className='py-2 pr-4 text-muted-foreground'>{sub.source ?? '-'}</td>
                      <td className='py-2 pr-4'>
                        {sub.unsubscribedAt ? (
                          <Badge variant='destructive'>Unsubscribed</Badge>
                        ) : (
                          <Badge variant='secondary'>Active</Badge>
                        )}
                      </td>
                      <td className='py-2 text-muted-foreground'>
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
