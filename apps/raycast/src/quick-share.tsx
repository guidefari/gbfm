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

interface QuickShareFormData {
  url: string
  notes: string
  title: string
  slug: string
  tags: string[]
  draft: boolean
}

export default function QuickShare() {
  const [formData, setFormData] = useState<QuickShareFormData>({
    url: '',
    notes: '',
    title: `Quick share - ${new Date().toLocaleDateString()}`,
    slug: Date.now().toString(36),
    tags: [],
    draft: true
  })

  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (values: QuickShareFormData) => {
    setIsLoading(true)

    const createQuickShareEffect = Effect.gen(function* () {
      yield* Effect.logInfo('Creating quick share', {
        url: values.url,
        hasNotes: !!values.notes
      })

      const content = values.notes
        ? `${values.url}\n\n${values.notes}`
        : values.url

      const requestBody = {
        title: values.title,
        slug: values.slug,
        content,
        type: 'micro' as const,
        draft: values.draft,
        tags: values.tags.length > 0 ? values.tags : undefined
      }

      yield* Effect.logDebug('Request payload', requestBody)

      const response = yield* Effect.promise(() =>
        post('/content/post', requestBody)
      )

      const result = yield* Effect.promise(() =>
        parseJsonResponse<{
          id: string
          title: string
          slug: string
        }>(response)
      )

      yield* Effect.logInfo('Quick share created', {
        id: result.id,
        slug: result.slug
      })

      yield* Effect.promise(() =>
        showToast({
          style: Toast.Style.Success,
          title: 'Shared!',
          message: `"${result.title}" created`
        })
      )

      return result
    })

    try {
      await Runtime.runPromise(Runtime.defaultRuntime)(createQuickShareEffect)
      popToRoot()
    } catch (error) {
      await Runtime.runPromise(Runtime.defaultRuntime)(
        Effect.logError('Quick share creation failed', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
      )

      await showToast({
        style: Toast.Style.Failure,
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to create share'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // const generateNewSlug = () => {
  //   setFormData((prev) => ({
  //     ...prev,
  //     slug: Date.now().toString(36)
  //   }))
  // }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title='Share' onSubmit={handleSubmit} icon='📤' />
        </ActionPanel>
      }
      isLoading={isLoading}>
      <Form.TextField
        id='url'
        title='URL'
        placeholder='Paste music link here (Spotify, Bandcamp, YouTube, etc.)'
        value={formData.url}
        onChange={(value) => {
          setFormData((prev) => ({
            ...prev,
            url: value
          }))
        }}
        info='Any music link - the frontend will handle rendering'
      />

      <Form.TextArea
        id='notes'
        title='Notes'
        placeholder='Your thoughts, comments, or context about this music...'
        value={formData.notes}
        onChange={(value) => setFormData((prev) => ({ ...prev, notes: value }))}
        info='Optional - add any commentary or context'
      />

      <Form.Separator />

      <Form.TextField
        id='title'
        title='Title'
        placeholder='Title for this share'
        value={formData.title}
        onChange={(value) => setFormData((prev) => ({ ...prev, title: value }))}
      />

      <Form.TextField
        id='slug'
        title='Slug'
        placeholder='URL-friendly identifier'
        value={formData.slug}
        onChange={(value) => setFormData((prev) => ({ ...prev, slug: value }))}
        info='Short timestamp-based slug - click to regenerate'
      />

      <Form.TagPicker
        id='tags'
        title='Tags (Optional)'
        placeholder='Add genre tags'
        value={formData.tags}
        onChange={(value) => setFormData((prev) => ({ ...prev, tags: value }))}>
        <Form.TagPicker.Item value='house' title='House' />
        <Form.TagPicker.Item value='techno' title='Techno' />
        <Form.TagPicker.Item value='dnb' title='DnB' />
        <Form.TagPicker.Item value='ambient' title='Ambient' />
        <Form.TagPicker.Item value='jazz' title='Jazz' />
        <Form.TagPicker.Item value='hip-hop' title='Hip Hop' />
        <Form.TagPicker.Item value='experimental' title='Experimental' />
        <Form.TagPicker.Item value='footwork' title='Footwork' />
      </Form.TagPicker>

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
