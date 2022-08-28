// @ts-nocheck
import fetcher from '@/lib/fetcher'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { MinimalCard } from './common/MinimalCard'
// import { parse } from 'spotify-uri'
// const { parse } = require('spotify-uri')

export default function Album({ url, genres }) {
  // const [data, setData] = useState({ artists: 'none', albumImageUrl: 'https://', title: 'hte' })

  // useEffect(() => {
  //   getStuff()
  // }, [])

  // async function getStuff() {
  //   // const data = await fetch(`/api/album?id=${url}`)
  //   // console.log(data)

  //   // setData(data)
  // }
  const { data, error } = useSWR(`/api/album?id=${url}`, fetcher)
  const loading = !data && !error

  return (
    <div>
      <MinimalCard
        loading={loading}
        slug={data?.albumUrl || ''}
        blurb={data?.artists || ''}
        imageUrl={data?.albumImageUrl}
        title={data?.title || ''}
        genres={genres || ''}
        previewUrl={data?.previewUrl || ''}
      />
    </div>
  )
}
