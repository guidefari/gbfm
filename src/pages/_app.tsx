import '@/css/main.css'
import { AudioProvider } from 'src/contexts/AudioPlayer'
import { AppProps } from 'next/app'

import Head from 'next/head'
import { memo } from 'react'
import AppShell from '@/components/Layouts/AppShell'
import { ScrollPosition } from '@/components/ScrollPosition'
import { SessionProvider } from 'next-auth/react'

const App = memo(function _({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Head>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link rel="shortcut icon" href="/favicons/goose.png" type="image/x-icon" />
      </Head>
      <ScrollPosition />
      <AudioProvider>
        <AppShell>
          <Component {...pageProps} />
        </AppShell>
      </AudioProvider>
    </SessionProvider>
  )
})

export default App
