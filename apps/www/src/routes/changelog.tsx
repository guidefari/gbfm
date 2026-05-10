import { createFileRoute } from '@tanstack/react-router'
import { CustomMDXComponents } from '@/components/mdx-components'
import changelog from '@/mdx/changelog.md'

export const Route = createFileRoute('/changelog')({
  component: ChangelogPage
})

function ChangelogPage() {
  return (
    <main className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10'>
      <section className=' border border-border/60 bg-background/80 p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.8)] backdrop-blur'>
        <h1 className='text-4xl font-black tracking-tight text-foreground sm:text-5xl my-0 text-center'>
          Changelog
        </h1>

        <p className='mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base'>
          Latest release notes, updates, and fixes. This page is generated from
          the repository changelog so it stays in lockstep with each publish.
        </p>
      </section>

      <section className='border border-border/60 bg-background/70 p-4 shadow-sm sm:p-6'>
        <div className='changelog-prose prose prose-neutral dark:prose-invert max-w-none'>
          {changelog({ components: CustomMDXComponents })}
        </div>
      </section>
    </main>
  )
}
