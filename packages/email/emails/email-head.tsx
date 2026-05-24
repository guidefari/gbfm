import { Head } from '@react-email/components'

const baseCss = `
a[x-apple-data-detectors] {
  color: inherit !important;
  text-decoration: inherit !important;
}
`

export function EmailHead() {
  return (
    <Head>
      <meta content='light dark' name='color-scheme' />
      <meta content='light dark' name='supported-color-schemes' />
      <style>{baseCss}</style>
    </Head>
  )
}
