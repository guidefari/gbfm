import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { TweetActionsMenu } from '@/components/TweetActionsMenu'
import { TweetCardActions } from '@/components/TweetCardActions'
import { TweetMusicEntityCard } from '@/components/TweetMusicEntityCard'
import { TweetNav } from '@/components/TweetNav'
import { TweetParentPreview } from '@/components/TweetParentPreview'
import { TweetQuoteCard } from '@/components/TweetQuoteCard'
import { TweetReplyComposer } from '@/components/TweetReplyComposer'
import { TweetReplyList } from '@/components/TweetReplyList'
import { useMicroPostReplies } from '@/lib/http'
import { queryClient } from '@/lib/query-client'

function Providers({ children }: { readonly children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export function TweetNavigationIsland({ slug }: { readonly slug: string }) {
  return (
    <Providers>
      <TweetNav slug={slug} />
    </Providers>
  )
}

export function TweetParentIsland({ parentPostId }: { readonly parentPostId: string }) {
  return (
    <Providers>
      <TweetParentPreview parentPostId={parentPostId} />
    </Providers>
  )
}

export function TweetMusicIsland({
  entityType,
  entityId
}: {
  readonly entityType: string
  readonly entityId: string
}) {
  return (
    <Providers>
      <TweetMusicEntityCard entityType={entityType} entityId={entityId} />
    </Providers>
  )
}

export function TweetQuoteIsland({ quotedPostId }: { readonly quotedPostId: string }) {
  return (
    <Providers>
      <TweetQuoteCard quotedPostId={quotedPostId} />
    </Providers>
  )
}

function TweetActions({ slug, canEdit }: { readonly slug: string; readonly canEdit: boolean }) {
  const { data } = useMicroPostReplies(slug)
  const replyCount = data?.data.length ?? 0

  return (
    <TweetCardActions
      slug={slug}
      canEdit={canEdit}
      replyCount={replyCount}
      onReplyCountClick={() =>
        document.getElementById('replies')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    />
  )
}

export function TweetActionsIsland({
  slug,
  canEdit
}: {
  readonly slug: string
  readonly canEdit: boolean
}) {
  return (
    <Providers>
      <TweetActions slug={slug} canEdit={canEdit} />
      <TweetActionsMenu />
    </Providers>
  )
}

export function TweetRepliesIsland({ slug }: { readonly slug: string }) {
  return (
    <Providers>
      <div className='space-y-4'>
        <TweetReplyComposer parentSlug={slug} />
        <TweetReplyList parentSlug={slug} />
      </div>
    </Providers>
  )
}
