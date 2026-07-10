import perfLogSource from 'virtual:repo-perf-log'
import { compile } from '@mdx-js/mdx'
import { createFileRoute } from '@tanstack/react-router'
import { MDXRendrr } from '@/components/MDXRendrr'

export const Route = createFileRoute('/perf')({
  loader: async () => {
    const compiled = await compile(perfLogSource, {
      outputFormat: 'function-body'
    })

    return { perfLog: compiled.toString() }
  },
  component: PerfLogPage
})

function PerfLogPage() {
  const { perfLog } = Route.useLoaderData()

  return (
    <main className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10'>
      <section className=' border border-border/60 bg-background/80 p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.8)] backdrop-blur'>
        <h1 className='text-4xl font-black tracking-tight text-foreground sm:text-5xl my-0 text-center'>
          Performance log
        </h1>

        <p className='mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base'>
          Public log of load-time work on this site. Generated from the repository's performance log
          so it stays in lockstep with what actually shipped.
        </p>
      </section>

      <section className='border border-border/60 bg-background/70 p-4 shadow-sm sm:p-6'>
        <div className='changelog-prose prose prose-neutral dark:prose-invert max-w-none'>
          <MDXRendrr mdxString={perfLog} />
        </div>
      </section>
    </main>
  )
}
