import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_archetypeList/mixes')({
  component: () => <div>Hello /_archetypeList/mixes!</div>
})