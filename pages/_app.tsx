import { AudioControls } from '@/components/AudioControls'
import { BackIcon, GB } from '@/components/common/icons'
import '@/css/main.css'
import { AudioProvider } from 'contexts/AudioPlayer'

import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function App({ Component, pageProps }) {
  const router = useRouter()

  const buttonStyles =
    'z-20 text-[#54BCF7] p-3 md:m-5 transition duration-300 ease-in-out rounded-full w-14 h-14 hover:bg-gb-bg hover:shadow-md hover:text-tomato hover:cursor-pointer'

  return (
    <>
      <Head>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link rel="shortcut icon" href="/favicons/goose.png" type="image/x-icon" />
      </Head>
      <AudioProvider>
        <div className="grid h-screen grid-cols-12">
          <header className="grid bg-transparent col-span-full lg:col-span-1 ">
            <nav className="flex items-center space-y-2 lg:flex-col ">
              <Link href="/">
                <button className={buttonStyles}>
                  <GB />
                </button>
              </Link>
              <button className={buttonStyles}>
                <AudioControls />
              </button>
            </nav>
          </header>
          <div className="grid overflow-scroll col-span-full lg:col-span-11">
            <Component {...pageProps} />
          </div>
          <nav className="grid col-span-1"></nav>
        </div>
      </AudioProvider>
    </>
  )
}
