import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/mixes/')({
  component: Component
})

function Component() {
  return (
    <div className='flex flex-col items-center justify-center h-full text-center'>
      <h2 className='mb-2 text-lg font-bold'>Select a Mix</h2>
      <p className='text-sm text-muted-foreground'>
        Click on a mix from the list to view its details here
      </p>
    </div>
  )
}
