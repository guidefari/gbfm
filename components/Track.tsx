// @ts-nocheck
import fetcher from '@/lib/fetcher'
import useSWR from 'swr'
import { MinimalCard } from './common/MinimalCard'

export default function Track({ url, genres, blurb, children }) {
  const encoded = encodeURIComponent(url)

  const { data, error } = useSWR(`/api/track?id=${encoded}`, fetcher)
  const loading = !data && !error

  return (
    <div>
      <MinimalCard
        loading={loading}
        blurb={blurb || ''}
        slug={data?.trackUrl || ''}
        imageUrl={data?.albumImageUrl || ''}
        title={data?.title || ''}
        artists={data?.artists || ''}
        genres={genres || ''}
        previewUrl={data?.previewUrl || ''}
      >
        {children}
      </MinimalCard>
    </div>
  )
}
