import {
  Action,
  ActionPanel,
  Form,
  popToRoot,
  showToast,
  Toast
} from '@raycast/api'
import { Effect } from 'effect'
import { useState } from 'react'
import { parseJsonResponse, post } from './api-client'

interface LabelFormData {
  title: string
  description: string
  thumbnailUrl: string
  slug: string
  content: string
  website: string
  bandcamp: string
  discogs: string
  genres: string[]
  draft: boolean
}

export default function CreateLabel() {
  const [formData, setFormData] = useState<LabelFormData>({
    title: '',
    description: '',
    thumbnailUrl: '',
    slug: '',
    content: '',
    website: '',
    bandcamp: '',
    discogs: '',
    genres: [],
    draft: true
  })

  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (values: LabelFormData) => {
    setIsLoading(true)

    const createLabelEffect = Effect.gen(function* () {
      yield* Effect.logInfo('Starting label creation process', {
        title: values.title
      })

      const requestBody = {
        ...values
      }

      yield* Effect.logDebug('Preparing to create label', {
        title: values.title,
        slug: values.slug
      })

      const response = yield* Effect.promise(() =>
        post('/content/labels', requestBody)
      )

      const result = yield* Effect.promise(() =>
        parseJsonResponse<{
          id: string
          title: string
          slug: string
        }>(response)
      )

      yield* Effect.logInfo('Label created successfully', {
        labelId: result.id,
        title: result.title,
        slug: result.slug
      })

      yield* Effect.promise(() =>
        showToast({
          style: Toast.Style.Success,
          title: 'Label Created',
          message: `Label "${result.title}" created successfully`
        })
      )

      return result
    })

    try {
      await Effect.runPromise(createLabelEffect)
      popToRoot()
    } catch (error) {
      await Effect.runPromise(
        Effect.logError('Label creation failed with unhandled error', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
      )

      await showToast({
        style: Toast.Style.Failure,
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to create label'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const generateSlugFromTitle = (title: string) => {
    if (!title) return ''
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title='Create Label'
            onSubmit={handleSubmit}
            icon='✨'
          />
        </ActionPanel>
      }
      isLoading={isLoading}>
      <Form.TextField
        id='title'
        title='Label Name'
        placeholder='Enter label name'
        value={formData.title}
        onChange={(value) => {
          setFormData((prev) => ({
            ...prev,
            title: value,
            slug: generateSlugFromTitle(value)
          }))
        }}
      />

      <Form.TextField
        id='slug'
        title='Slug'
        placeholder='URL-friendly slug (auto-generated from name)'
        value={formData.slug}
        onChange={(value) => setFormData((prev) => ({ ...prev, slug: value }))}
      />

      <Form.TextArea
        id='description'
        title='Description'
        placeholder='Short description of the label'
        value={formData.description}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, description: value }))
        }
      />

      <Form.TextField
        id='thumbnailUrl'
        title='Thumbnail URL'
        placeholder='URL to label logo/artwork'
        value={formData.thumbnailUrl}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, thumbnailUrl: value }))
        }
      />

      <Form.TextField
        id='website'
        title='Website'
        placeholder='https://label-website.com'
        value={formData.website}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, website: value }))
        }
      />

      <Form.TextField
        id='bandcamp'
        title='Bandcamp'
        placeholder='https://label.bandcamp.com'
        value={formData.bandcamp}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, bandcamp: value }))
        }
      />

      <Form.TextField
        id='discogs'
        title='Discogs'
        placeholder='https://www.discogs.com/label/...'
        value={formData.discogs}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, discogs: value }))
        }
      />

      <Form.TagPicker
        id='genres'
        title='Genres'
        placeholder='Add genres'
        value={formData.genres}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, genres: value }))
        }>
        <Form.TagPicker.Item value='house' title='House' />
        <Form.TagPicker.Item value='techno' title='Techno' />
        <Form.TagPicker.Item value='deep-house' title='Deep House' />
        <Form.TagPicker.Item value='progressive' title='Progressive' />
        <Form.TagPicker.Item value='ambient' title='Ambient' />
        <Form.TagPicker.Item value='minimal' title='Minimal' />
        <Form.TagPicker.Item value='breaks' title='Breaks' />
        <Form.TagPicker.Item value='dnb' title='Drum & Bass' />
        <Form.TagPicker.Item value='dubstep' title='Dubstep' />
        <Form.TagPicker.Item value='experimental' title='Experimental' />
      </Form.TagPicker>

      <Form.TextArea
        id='content'
        title='Content'
        placeholder='Label description in markdown format'
        value={formData.content}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, content: value }))
        }
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
