import { useEffect, useState } from 'react'
import { SimpleMarkdownEditor } from './simple-markdown-editor'

import { Button } from '@gbfm/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { Option, Schema } from 'effect'
import { useForm } from 'react-hook-form'
import { log } from '@/services/logger'
import { apiUrl, fetcher } from '@/lib/http'

type ContentType = {
  value: string
  label: string
}

const contentTypes: ContentType[] = [
  { value: 'micro', label: 'Micro Post' },
  { value: 'post', label: 'Post' },
  { value: 'mix', label: 'Mix' }
]

function isEditorContentType(value: string): value is 'micro' | 'post' | 'mix' {
  return value === 'micro' || value === 'post' || value === 'mix'
}

const contentSchema = Schema.Struct({
  content: Schema.NonEmptyString,
  dateCreated: Schema.Number,
  dateUpdated: Schema.Number,
  type: Schema.Literals(['micro', 'post', 'mix'])
})

type FormData = typeof contentSchema.Type

const Email = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(
      /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/
    )
  )
)

const searchSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  email: Schema.optional(Email),
  token: Schema.optional(Schema.String)
})

export function Editor() {
  const [value, setValue] = useState('')
  const searchParams = useSearch({
    strict: false
  })
  const parsed = Schema.decodeUnknownOption(searchSchema)(searchParams)
  const { id } = Option.isSome(parsed) ? parsed.value : { id: undefined }
  const [type, setType] = useState<'micro' | 'post' | 'mix'>('post')

  const form = useForm<FormData>({
    defaultValues: {
      content: '',
      dateCreated: Date.now(),
      dateUpdated: Date.now(),
      type: 'post'
    }
  })

  const { data: existingContent } = useQuery<FormData | null>({
    queryKey: ['content', id],
    queryFn: async () => {
      if (!id) return null
      return await fetcher(apiUrl(`/content/${id}`))
    },
    enabled: Boolean(id)
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: FormData) => {
      const endpoint = id ? apiUrl(`/content/${id}`) : apiUrl('/content')
      const method = id ? 'PUT' : 'POST'

      return await fetcher(endpoint, {
        method,
        body: JSON.stringify(data)
      })
    }
  })

  useEffect(() => {
    log('debug', 'existingContent', { existingContent })
    if (existingContent) {
      setValue(existingContent.content)
      form.setValue('content', existingContent.content)
    }
  }, [existingContent, form])

  const onSubmit = form.handleSubmit((data) => {
    mutate(data)
  })

  return (
    <form onSubmit={onSubmit}>
      <section>
        <Button onClick={() => mutate(form.getValues())} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save'}
        </Button>
        <select
          value={type}
          onChange={(e) => {
            if (isEditorContentType(e.target.value)) {
              setType(e.target.value)
            }
          }}>
          {contentTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <SimpleMarkdownEditor
          key={id}
          value={value}
          onChange={(content) => {
            setValue(content)
            form.setValue('content', content)
          }}
          placeholder='Write your content in MDX...'
        />
      </section>
    </form>
  )
}
