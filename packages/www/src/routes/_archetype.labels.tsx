import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_archetype/labels')({
  component: () => <div>Hello /mixes/$id!</div>
})