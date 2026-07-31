import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/mixes/')({
  beforeLoad: () => {
    throw redirect({ to: '/', replace: true })
  }
})
