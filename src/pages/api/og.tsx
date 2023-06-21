import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const config = {
  runtime: 'edge',
}

export default function (req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const hasTitle = searchParams.has('title')
  const title = hasTitle ? searchParams.get('title')?.slice(0, 100) : 'My default title'

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
          fontSize: '20rem',
        }}
      >
        <h1 className='text-center text-7xl'>{title}</h1>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
