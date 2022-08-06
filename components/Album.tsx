// @ts-nocheck
import fetcher from '@/lib/fetcher'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { MinimalCard } from './common/MinimalCard'
// import { parse } from 'spotify-uri'
// const { parse } = require('spotify-uri')

export default function Album({ url }) {
  // const [data, setData] = useState({ artists: 'none', albumImageUrl: 'https://', title: 'hte' })

  // useEffect(() => {
  //   getStuff()
  // }, [])

  // async function getStuff() {
  //   // const data = await fetch(`/api/album?id=${url}`)
  //   // console.log(data)

  //   // setData(data)
  // }
  const { data } = useSWR(`/api/album?id=${url}`, fetcher)
  console.log(data)

  return (
    <div>
      {data ? (
        <MinimalCard
          slug={'bro'}
          blurb={data.artists || ''}
          imageUrl={data.albumImageUrl || ''}
          title={data.title || ''}
        />
      ) : (
        ''
      )}
    </div>
  )
}
