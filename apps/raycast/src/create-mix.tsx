import {
  Action,
  ActionPanel,
  Form,
  popToRoot,
  showToast,
  Toast
} from '@raycast/api'
import { Effect, Runtime } from 'effect'
import { useState } from 'react'
import { parseJsonResponse, post } from './api-client'
import { extractTracklistAsJSXEffect } from './util'

interface MixFormData {
  title: string
  description: string
  thumbnailUrl: string
  slug: string
  url: string
  creatorIds: string[]
  tags: string[]
  content: string
  tracklist: string
  draft: boolean
}

export default function CreateMix() {
  const [formData, setFormData] = useState<MixFormData>({
    title: '',
    description: '',
    thumbnailUrl: '',
    slug: '',
    url: 'https://cdn.goosebumps.fm/mixes/',
    creatorIds: [],
    tags: [],
    content: '',
    tracklist: '',
    draft: true
  })

  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (values: MixFormData) => {
    setIsLoading(true)

    const createMixEffect = Effect.gen(function* () {
      yield* Effect.logInfo('Starting mix creation process', {
        title: values.title
      })

      const processedTracklist = yield* extractTracklistAsJSXEffect(
        values.tracklist
      ).pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Effect.logError('Failed to process tracklist', {
              error: error._tag,
              tracklist: values.tracklist
            })
            return ''
          })
        )
      )

      yield* Effect.logDebug('Tracklist processed successfully', {
        tracklistLength: values.tracklist.length
      })

      const finalContent =
        values.content +
        (processedTracklist ? `\n\n## Tracklist\n\n${processedTracklist}` : '')

      const { tracklist, ...submitData } = values
      console.log(tracklist)

      const requestBody = {
        ...submitData,
        content: finalContent,
        type: 'mix'
      }

      yield* Effect.logDebug('Preparing to create mix', {
        title: values.title,
        slug: values.slug,
        hasContent: !!finalContent
      })

      const response = yield* Effect.promise(() =>
        post('/content/mixes', requestBody)
      )

      const result = yield* Effect.promise(() =>
        parseJsonResponse<{
          id: string
          title: string
          slug: string
        }>(response)
      )

      yield* Effect.logInfo('Mix created successfully', {
        mixId: result.id,
        title: result.title,
        slug: result.slug
      })

      yield* Effect.promise(() =>
        showToast({
          style: Toast.Style.Success,
          title: 'Mix Created',
          message: `Mix "${result.title}" created successfully`
        })
      )

      return result
    })

    try {
      await Runtime.runPromise(Runtime.defaultRuntime)(createMixEffect)
      popToRoot()
    } catch (error) {
      await Runtime.runPromise(Runtime.defaultRuntime)(
        Effect.logError('Mix creation failed with unhandled error', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
      )

      await showToast({
        style: Toast.Style.Failure,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to create mix'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const generateSlugFromUrl = (url: string) => {
    if (!url) {
      Runtime.runSync(Runtime.defaultRuntime)(
        Effect.logDebug('Empty URL provided for slug generation')
      )
      return ''
    }

    const generateSlugEffect = Effect.gen(function* () {
      yield* Effect.logDebug('Generating slug from URL', { url })

      const result = yield* Effect.try({
        try: () => {
          const urlObj = new URL(url)
          const pathname = urlObj.pathname
          const filename = pathname.split('/').pop() || ''

          const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
          const slug = nameWithoutExt
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')

          return { slug, filename, pathname, method: 'url-parse' as const }
        },
        catch: (error) => {
          const parts = url.split('/')
          const filename = parts[parts.length - 1] || ''
          const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
          const slug = nameWithoutExt
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')

          return { slug, filename, error, method: 'fallback' as const }
        }
      })

      if (result.method === 'url-parse') {
        yield* Effect.logDebug('Successfully parsed URL', {
          pathname: 'pathname' in result ? result.pathname : undefined,
          filename: result.filename,
          slug: result.slug
        })
      } else {
        yield* Effect.logWarning('Failed to parse URL, used fallback method', {
          url,
          error: 'error' in result ? result.error : undefined,
          filename: result.filename,
          slug: result.slug
        })
      }

      return result.slug
    })

    return Runtime.runSync(Runtime.defaultRuntime)(generateSlugEffect)
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title='Create Mix'
            onSubmit={handleSubmit}
            icon='✨'
          />
        </ActionPanel>
      }
      isLoading={isLoading}>
      <Form.TextField
        id='title'
        title='Title'
        placeholder='Enter mix title'
        value={formData.title}
        onChange={(value) => {
          setFormData((prev) => ({
            ...prev,
            title: value
          }))
        }}
      />

      <Form.TextField
        id='url'
        title='Audio URL'
        placeholder='Direct URL to the audio file'
        value={formData.url}
        onChange={(value) => {
          setFormData((prev) => ({
            ...prev,
            url: value,
            slug: generateSlugFromUrl(value)
          }))
        }}
      />

      <Form.TextField
        id='slug'
        title='Slug'
        placeholder='URL-friendly slug (auto-generated from audio url)'
        value={formData.slug}
        onChange={(value) => setFormData((prev) => ({ ...prev, slug: value }))}
      />

      {/* <Form.TextArea
        id="description"
        title="Short description"
        placeholder="Enter mix description"
        value={formData.description}
        onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
      /> */}

      {/* <Form.TextField
        id="thumbnailUrl"
        title="Thumbnail URL"
        placeholder="URL to cover image/thumbnail"
        value={formData.thumbnailUrl}
        onChange={(value) => setFormData(prev => ({ ...prev, thumbnailUrl: value }))}
      /> */}

      {/* <Form.TagPicker
        id="creatorIds"
        title="Creator IDs"
        placeholder="Add creator UUIDs"
        value={formData.creatorIds}
        onChange={(value) => setFormData(prev => ({ ...prev, creatorIds: value }))}
      >
        <Form.TagPicker.Item
          value=""
          title="Add Creator ID..."
        />
      </Form.TagPicker> */}

      {/* <Form.TagPicker
        id="tags"
        title="Tags"
        placeholder="Add tags"
        value={formData.tags}
        onChange={(value) => setFormData(prev => ({ ...prev, tags: value }))}
      >
        <Form.TagPicker.Item
          value="house"
          title="House"
        />
        <Form.TagPicker.Item
          value="techno"
          title="Techno"
        />
        <Form.TagPicker.Item
          value="deep-house"
          title="Deep House"
        />
        <Form.TagPicker.Item
          value="progressive"
          title="Progressive"
        />
        <Form.TagPicker.Item
          value="ambient"
          title="Ambient"
        />
      </Form.TagPicker> */}

      {/* <Form.TextArea
        id="content"
        title="Content"
        placeholder="Mix description in markdown format"
        value={formData.content}
        onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
      /> */}

      <Form.TextArea
        id='tracklist'
        title='Tracklist'
        placeholder='Paste tracklist here (one track per line)&#10;Artist - Track Title&#10;Another Artist - Another Track'
        value={formData.tracklist}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, tracklist: value }))
        }
        info='Tracklist will be automatically formatted and appended to content'
      />

      <Form.Checkbox
        id='draft'
        title='Draft'
        label='Save as draft'
        value={formData.draft}
        onChange={(value) => setFormData((prev) => ({ ...prev, draft: value }))}
      />
    </Form>
  )
}
