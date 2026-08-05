import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/all')({
  beforeLoad: () => {
    throw redirect({
      to: '/dashboard/all/mixes',
      search: { offset: 0, sort: 'created', order: 'desc' }
    })
  }
})
