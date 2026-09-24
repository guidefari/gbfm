import { createFileRoute, redirect } from '@tanstack/react-router'
import { Schema } from 'effect'

const searchSchema = Schema.Struct({
  edit: Schema.optional(Schema.String)
})

export const Route = createFileRoute('/new/tweet')({
  validateSearch: Schema.toStandardSchemaV1(searchSchema),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/new', search: { mode: 'tweet', edit: search.edit } })
  }
})
