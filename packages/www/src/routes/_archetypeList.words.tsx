import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_archetypeList/words')({
  component: () => <div>Hello /_archetypeList/words!</div>
})