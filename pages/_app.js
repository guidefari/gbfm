import "@/css/main.css"

// import '@fontsource/inter/variable-full.css'

import Head from "next/head"

// import LayoutWrapper from "@/components/LayoutWrapper"

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
      </Head>
      {/* <LayoutWrapper> */}
      <Component {...pageProps} />
      {/* </LayoutWrapper> */}
    </>
  )
}
