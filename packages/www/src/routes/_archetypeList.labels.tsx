import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_archetypeList/labels')({
  component: () => <div>Hello /mixes/$id!</div>
})