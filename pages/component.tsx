import { Playlist } from '@/components/Playlist'

export default function Collaborate() {
  return (
    <>
      <section className="">
        <div className="max-w-screen-xl px-4 pb-8 mx-auto sm:py-16 lg:px-6">
          <Playlist
            genres={['Bass', 'test']}
            url="https://open.spotify.com/playlist/3k1YTNJ6mbuFMJRvqGvIOn?si=22c421982ac146ed"
            blurb="Component testing right ehre I wonder what happens when you thingy it"
          />
        </div>
      </section>
    </>
  )
}
