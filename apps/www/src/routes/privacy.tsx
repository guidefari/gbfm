import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage
})

function PrivacyPage() {
  return (
    <div className='mx-auto max-w-2xl space-y-4 px-6 py-12'>
      <h1 className='text-3xl font-bold'>Privacy Policy</h1>
      <p className='text-muted-foreground'>
        Placeholder. Full policy coming soon. We store the minimum needed to run
        the service: account info, listening activity you create, and basic
        analytics. We do not sell your data.
      </p>
    </div>
  )
}
