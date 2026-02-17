import { Head } from '@react-email/components'

const forcedColorSchemeCss = `
:root {
  color-scheme: dark;
  supported-color-schemes: dark;
}

body {
  background-color: #111827 !important;
}

a[x-apple-data-detectors] {
  color: inherit !important;
  text-decoration: inherit !important;
}
`

export function EmailHead() {
  return (
    <Head>
      <meta content='dark' name='color-scheme' />
      <meta content='dark' name='supported-color-schemes' />
      <style>{forcedColorSchemeCss}</style>
    </Head>
  )
}
