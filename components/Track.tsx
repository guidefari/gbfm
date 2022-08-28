// @ts-nocheck
import fetcher from '@/lib/fetcher'
import useSWR from 'swr'
import { MinimalCard } from './common/MinimalCard'

export default function Album({ url, genres }) {
  const { data, error } = useSWR(`/api/track?id=${url}`, fetcher)
  const loading = !data && !error

  return (
    <div>
      <MinimalCard
        loading={loading}
        slug={data?.trackUrl || ''}
        blurb={data?.artists || ''}
        imageUrl={data?.albumImageUrl || ''}
        title={data?.title || ''}
        genres={genres || ''}
        previewUrl={data?.previewUrl || ''}
      />
    </div>
  )
}
