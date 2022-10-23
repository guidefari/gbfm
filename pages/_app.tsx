import { AudioControls } from '@/components/AudioControls'
import '@/css/main.css'
import { AudioProvider } from 'contexts/AudioPlayer'

// import '@fontsource/inter/variable-full.css'

import Head from 'next/head'

// import LayoutWrapper from "@/components/LayoutWrapper"

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link rel="shortcut icon" href="/favicons/goose.png" type="image/x-icon" />
      </Head>
      <AudioProvider>
        <div className="fixed top-0 right-0 ">
          <AudioControls />
        </div>
        <Component {...pageProps} />
      </AudioProvider>
    </>
  )
}
