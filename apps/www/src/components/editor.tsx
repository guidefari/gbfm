import { useEffect, useState } from 'react'
import ReactMde from 'react-mde'
// import { getDefaultToolbarCommands } from "react-mde";
import { MDXRendrr } from './MDXRendrr'
// import "react-mde/lib/styles/css/react-mde-all.css";
import 'react-mde/lib/styles/css/react-mde-toolbar.css'
import 'react-mde/lib/styles/css/react-mde.css'
import 'react-mde/lib/styles/css/react-mde-editor.css'
import './editor.css'
import { compile } from '@mdx-js/mdx'
import { useMutation, useQuery } from '@tanstack/react-query'
import { VPS_BASE_URL, fetcher } from '@/lib/http'
import { Button } from './ui/button'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearch } from '@tanstack/react-router'

type ContentType = {
  value: string
  label: string
}

const contentTypes: ContentType[] = [
  { value: 'micro', label: 'Micro Post' },
  { value: 'post', label: 'Post' },
  { value: 'mix', label: 'Mix' }
]

const contentSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  dateCreated: z.number(),
  dateUpdated: z.number(),
  type: z.enum(['micro', 'post', 'mix'])
})

type FormData = z.infer<typeof contentSchema>

const searchSchema = z.object({
  id: z.string().optional(),
  email: z.string().email().optional(),
  token: z.string().optional()
})

export function Editor() {
  const [value, setValue] = useState('')
  const searchParams = useSearch({
    strict: false
  })
  const parsed = searchSchema.safeParse(searchParams)
  const { id } = parsed.success ? parsed.data : { id: undefined }
  const [selectedTab, setSelectedTab] = useState<'write' | 'preview'>('write')
  const [type, setType] = useState<'micro' | 'post' | 'mix'>('post')

  const save = async function* (_data: ArrayBuffer) {
    // Promise that waits for "time" milliseconds
    const wait = (time: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, time)
      })

    // Upload "data" to your server
    // Use XMLHttpRequest.send to send a FormData object containing
    // "data"
    // Check this question: https://stackoverflow.com/questions/18055422/how-to-receive-php-image-data-over-copy-n-paste-javascript-with-xmlhttprequest

    await wait(2000)
    // yields the URL that should be inserted in the markdown
    yield 'https://picsum.photos/300'
    await wait(2000)

    // returns true meaning that the save was successful
    return true
  }

  const form = useForm<FormData>({
    resolver: zodResolver(contentSchema),
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
      return await fetcher(`${VPS_BASE_URL}/content/${id}`)
    },
    enabled: !!id
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: FormData) => {
      const endpoint = id
        ? `${VPS_BASE_URL}/content/${id}`
        : `${VPS_BASE_URL}/content`
      const method = id ? 'PUT' : 'POST'

      return await fetcher(endpoint, {
        method,
        body: JSON.stringify(data)
      })
    }
  })

  // Update form with existing content when available
  useEffect(() => {
    console.log('existingContent:', existingContent)
    if (existingContent) {
      setValue(existingContent.content)
    }
  }, [existingContent])

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
          onChange={(e) => setType(e.target.value as 'micro' | 'post' | 'mix')}>
          {contentTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <ReactMde
          key={id}
          value={value}
          onChange={setValue}
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
          generateMarkdownPreview={async (markdown) => {
            const compiled = await compileMdx(markdown)
            return Promise.resolve(<MDXRendrr mdxString={compiled} />)
          }}
          childProps={{
            writeButton: {
              tabIndex: -1
              // className: "focus:outline-none focus:underline",
            },
            previewButton: {
              // className: "focus:outline-none focus:underline",
            }
          }}
          paste={{
            saveImage: save
          }}
          classes={{
            textArea: 'focus:outline-none bg-transparent label:rounded-lg ',
            toolbar: 'bg-transparent border-none',
            reactMde: 'focus:outline-none border-none'
          }}
          toolbarCommands={[['link', 'image']]}
        />
      </section>
    </form>
  )
}

async function compileMdx(markdown: string) {
  // const gray = matter(markdown);
  const compiled = await compile(markdown, {
    outputFormat: 'function-body'
  })
  return compiled.toString()
}
