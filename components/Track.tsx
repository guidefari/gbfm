// @ts-nocheck
import fetcher from '@/lib/fetcher'
import useSWR from 'swr'
import { MinimalCard } from './common/MinimalCard'

export default function Album({ url, genres }) {
  const { data } = useSWR(`/api/track?id=${url}`, fetcher)
  console.log(data)

  return (
    <div>
      {data ? (
        <MinimalCard
          slug={data.trackUrl}
          blurb={data.artists || ''}
          imageUrl={data.albumImageUrl || ''}
          title={data.title || ''}
          genres={genres || ''}
        />
      ) : (
        ''
      )}
    </div>
  )
}
