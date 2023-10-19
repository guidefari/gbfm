import '@/css/main.css'
import { AudioProvider } from 'src/contexts/AudioPlayer'
import { AppProps } from 'next/app'

import Head from 'next/head'
import { memo } from 'react'
import Layout from '@/components/Layout'
import { ScrollPosition } from '@/components/ScrollPosition'

const App = memo(({ Component, pageProps }: AppProps) => (
  <>
    <Head>
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <link rel="shortcut icon" href="/favicons/goose.png" type="image/x-icon" />
    </Head>
    <ScrollPosition />
    <AudioProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </AudioProvider>
  </>
))

export default App
