import { Collablock } from '@/components/Collablock'

export default function Collaborate() {
  return (
    <section className="">
      <div className="max-w-screen-xl px-4 pb-8 mx-auto sm:py-16 lg:px-6">
        <h2 className="mb-8 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Collaborative Efforts
        </h2>
        <div className="grid pt-8 text-left border-t border-gray-200 md:gap-16 dark:border-gray-700 md:grid-cols-2">
          <div>
            <Collablock title="What do you mean by that?">stuff</Collablock>
            <Collablock title="Conversational tone?">stuff</Collablock>
            <Collablock title="Share & talk about playlists">stuff</Collablock>
          </div>
          <div>
            <Collablock title="Contribute to an already published post">
              A lot of stuff will be WIP. I sometimes publish pre first draft, because I've found
              immense value in early feedback from readers & listeners. A way you can help is by
              filling in a gap you see.
            </Collablock>
            <Collablock title="Longform content">stuff</Collablock>
            <Collablock title="DJ Mixes">stuff</Collablock>
            <Collablock title="What are you listening to">stuff</Collablock>
          </div>
        </div>
      </div>
    </section>
  )
}
