// import { IsolatedAudio } from '@/components/IsolatedAudio'
// import Playlist from '@/components/Playlist'

// export default function Collaborate() {
//   return (
//     <>
//       <section className="">
//         <div className="max-w-screen-xl px-4 pb-8 mx-auto my-auto sm:py-16 lg:px-6">
//           <IsolatedAudio />
//         </div>
//       </section>
//     </>
//   )
// }

import Album from '@/components/Album'
import Track from '@/components/Track'
import * as ScrollArea from '@radix-ui/react-scroll-area'

export default function Scroll() {
  return (
    <>
      <Album
        url={'https://open.spotify.com/album/5F3YJdIjGHhnUVuD96G1mz?si=c14eLe_zR-mZtVg0-rD7Qg'}
      />

      <Track url={'https://open.spotify.com/track/6wcU2IeJ7iYxPHE0jT7Ess?si=cdea1f58e0224738'} />
      <ScrollArea.Root className="w-full shadow-sm ScrollAreaRoot">
        <ScrollArea.Viewport>
          <div className="flex h-full space-x-8">
            <Track
              url={'https://open.spotify.com/track/6wcU2IeJ7iYxPHE0jT7Ess?si=cdea1f58e0224738'}
            />
            <Track
              url={'https://open.spotify.com/track/6wcU2IeJ7iYxPHE0jT7Ess?si=cdea1f58e0224738'}
            />
            <Track
              url={'https://open.spotify.com/track/6wcU2IeJ7iYxPHE0jT7Ess?si=cdea1f58e0224738'}
            />
            <Track
              url={'https://open.spotify.com/track/6wcU2IeJ7iYxPHE0jT7Ess?si=cdea1f58e0224738'}
            />
            <Track
              url={'https://open.spotify.com/track/6wcU2IeJ7iYxPHE0jT7Ess?si=cdea1f58e0224738'}
            />
            <Track
              url={'https://open.spotify.com/track/6wcU2IeJ7iYxPHE0jT7Ess?si=cdea1f58e0224738'}
            />
            <Track
              url={'https://open.spotify.com/track/6wcU2IeJ7iYxPHE0jT7Ess?si=cdea1f58e0224738'}
            />
            <Track
              url={'https://open.spotify.com/track/6wcU2IeJ7iYxPHE0jT7Ess?si=cdea1f58e0224738'}
            />
          </div>
          <ScrollArea.Scrollbar orientation="horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner />
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    </>
  )
}
