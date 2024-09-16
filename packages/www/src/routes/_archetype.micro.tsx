import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_archetype/micro')({
  component: () => <div>Hello /_archetype/micro!</div>
})