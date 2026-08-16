export const Footer = () => {
  return (
    <footer className='sticky bottom-0 z-0 px-5'>
      <div className='container flex flex-col px-1 mx-auto w-full leading-none border-gray-200 lg:px-5'>
        <p className='mb-4 text-xs leading-relaxed text-right text-gray-500'>
          Metadata from{' '}
          <a
            className='underline underline-offset-2 hover:text-gray-700 focus-visible:text-gray-700'
            href='https://musicbrainz.org/'
            rel='noreferrer'
            target='_blank'>
            MusicBrainz
          </a>
          . Artwork from{' '}
          <a
            className='underline underline-offset-2 hover:text-gray-700 focus-visible:text-gray-700'
            href='https://coverartarchive.org/'
            rel='noreferrer'
            target='_blank'>
            Cover Art Archive
          </a>
          , hosted by{' '}
          <a
            className='underline underline-offset-2 hover:text-gray-700 focus-visible:text-gray-700'
            href='https://archive.org/'
            rel='noreferrer'
            target='_blank'>
            Internet Archive
          </a>
          .
        </p>
        <h1 className='my-0 text-5xl font-bold text-right md:text-8xl xl:text-9xl'>
          goosebumps.
          <br />
          <span className='text-highlight'>fm</span>
        </h1>
      </div>
    </footer>
  )
}
