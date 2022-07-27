import fetcher from '@/lib/fetcher'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { MinimalCard } from '../common/MinimalCard'
// import { parse } from 'spotify-uri'
// const { parse } = require('spotify-uri')

export const Album = ({ url }) => {
  const [data, setData] = useState({ artists: 'none', albumImageUrl: 'https://', title: 'hte' })

  useEffect(() => {
    getStuff()
  }, [])

  async function getStuff() {
    const data = await fetch(`/api/album?id=${url}`)
    // setData(data)
  }

  return (
    <div>
      <MinimalCard
        slug={'bro'}
        blurb={data.artists || ''}
        imageUrl={data.albumImageUrl || ''}
        title={data.title || ''}
      />
    </div>
  )
}
