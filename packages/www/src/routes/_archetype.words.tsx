import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_archetype/words')({
  component: () => <div>Hello /mixes/$id!</div>
})