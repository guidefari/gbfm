import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

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
