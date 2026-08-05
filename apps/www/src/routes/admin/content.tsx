import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/content')({
  beforeLoad: () => {
    throw redirect({
      to: '/admin/content/mixes',
      search: { offset: 0, sort: 'created', order: 'desc' }
    })
  }
})
