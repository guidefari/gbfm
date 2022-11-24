import Playlist from '@/components/Playlist'

export default function Collaborate() {
  return (
    <>
      <section className="">
        <div className="max-w-screen-xl px-4 pb-8 mx-auto my-auto sm:py-16 lg:px-6">
          <Playlist
            genres={['ambient', 'dub_techno', 'downtempo']}
            url="https://open.spotify.com/playlist/5vhNkJdvdPCs7GhLZDJ7R5?si=faa4e69bc6824f6b"
            blurb="Component testing right ehre I wonder what happens when you thingy it"
          />
        </div>
      </section>
    </>
  )
}
