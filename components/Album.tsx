// @ts-nocheck
import fetcher from '@/lib/fetcher'
import useSWR from 'swr'
import { MinimalCard } from './common/MinimalCard'
// import { parse } from 'spotify-uri'
// const { parse } = require('spotify-uri')

export default function Album({ url, genres, blurb, children }) {
  const { data, error } = useSWR(`/api/album?id=${url}`, fetcher)
  const loading = !data && !error

  return (
    <div>
      <MinimalCard
        blurb={blurb || ''}
        loading={loading}
        slug={data?.albumUrl || ''}
        artists={data?.artists || ''}
        imageUrl={data?.albumImageUrl}
        title={data?.title || ''}
        genres={genres || ''}
        previewUrl={data?.previewUrl || ''}
      >
        {children}
      </MinimalCard>
    </div>
  )
}
