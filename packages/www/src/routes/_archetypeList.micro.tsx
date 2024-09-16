import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_archetypeList/micro')({
  component: () => <div>Hello /_archetype/micro!</div>
})