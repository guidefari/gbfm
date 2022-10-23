import { AudioControls } from '@/components/AudioControls'
import { BackIcon } from '@/components/common/icons'
import '@/css/main.css'
import { AudioProvider } from 'contexts/AudioPlayer'

import Head from 'next/head'
import { useRouter } from 'next/router'

export default function App({ Component, pageProps }) {
  const router = useRouter()

  return (
    <>
      <Head>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link rel="shortcut icon" href="/favicons/goose.png" type="image/x-icon" />
      </Head>
      <AudioProvider>
        <header className="fixed top-0 flex justify-between w-full">
          <nav>
            <a onClick={() => router.back()} className="hover:text-highlight hover:cursor-pointer">
              <button className="z-20 p-3 m-5 bg-teal-900 rounded-full text-highlight">
                <BackIcon />
              </button>
            </a>
          </nav>
          <AudioControls />
        </header>
        <Component {...pageProps} />
      </AudioProvider>
    </>
  )
}
