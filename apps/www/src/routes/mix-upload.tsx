import { Schema } from 'effect'
import { createPageComponent } from '@/components/PageApp'
import { createFileRoute, redirect } from '@/lib/page'
import { privateHead } from '@/lib/seo'
import { MixUploadPage, mixUploadSearchSchema } from './mix-upload.lazy'

export const Route = createFileRoute('/mix-upload')({
  head: () => privateHead('Upload a mix'),
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/auth/sign-in', search: { redirect: location.href } })
    }
  },
  validateSearch: Schema.toStandardSchemaV1(mixUploadSearchSchema),
  component: MixUploadRoutePage
})

export const Page = createPageComponent(Route)

function MixUploadRoutePage() {
  return <MixUploadPage search={Route.useSearch()} />
}
