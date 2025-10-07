import { createFileRoute } from '@tanstack/react-router'
import { CustomMDXComponents } from '@/components/mdx-components'
import changelog from '@/mdx/changelog.md'

export const Route = createFileRoute('/changelog')({
  component: () => changelog({ components: CustomMDXComponents })
})
