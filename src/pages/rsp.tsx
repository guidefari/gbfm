import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */

  interface Session {
    token: {
      name: string
      email: string
      picture: string
      sub: string
      accessToken: string
      iat: number
      exp: number
      jti: string
    }
  }
}

export default function RSP() {
  const { data: session } = useSession()
  console.log('session:', session)
  const [list, setList] = useState([])

  const getMyPlaylists = async () => {
    const res = await fetch('/api/playlists')
    const { items } = await res.json()
    setList(items)
  }

  if (session) {
    return (
      <>
        Signed in as {session?.session?.user?.name} <br />
        <Image
          width={50}
          height={50}
          alt={session?.session?.user?.name}
          src={session?.session?.user?.image}
        />
        <hr />
        <button>
          <Link target="_blank" href={'/api/random-playlist'}>
            Random
          </Link>
        </button>
        <button onClick={() => signOut()}>Sign out</button>
      </>
    )
  }
  return (
    <>
      Not signed in <br />
      <button onClick={() => signIn()}>Sign in</button>
    </>
  )
}
