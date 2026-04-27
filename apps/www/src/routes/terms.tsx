import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/terms')({
  component: TermsPage
})

function TermsPage() {
  return (
    <div className='mx-auto max-w-2xl space-y-4 px-6 py-12'>
      <h1 className='text-3xl font-bold'>Terms of Service</h1>
      <p className='text-muted-foreground'>
        Placeholder. Full terms coming soon. Use the service in good faith. No
        scraping, no abuse, no impersonation. We can suspend accounts that
        violate these basics.
      </p>
    </div>
  )
}
