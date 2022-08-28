// @ts-nocheck
import fetcher from '@/lib/fetcher'
import useSWR from 'swr'
import { MinimalCard } from './common/MinimalCard'

export default function Track({ url, genres, blurb, children }) {
  const { data, error } = useSWR(`/api/track?id=${url}`, fetcher)
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
        children={children}
      />
    </div>
  )
}
