import { stripEmptyValues } from '@gbfm/core/utils'
import { Action, ActionPanel, Form, showToast, Toast } from '@raycast/api'
import { Effect, Runtime } from 'effect'
import { useEffect, useState } from 'react'
import { get, parseJsonResponse, patch } from './api-client'

type LabelFormData = Omit<Label, 'id'>

interface Label {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  slug: string
  content: string
  website: string | null
  bandcamp: string | null
  discogs: string | null
  genres: string[] | null
  draft: boolean
}

export default function EditLabel() {
  const [labels, setLabels] = useState<Label[]>([])
  const [selectedLabelSlug, setSelectedLabelSlug] = useState<string>('')
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
  const [isLoadingLabels, setIsLoadingLabels] = useState(true)

  useEffect(() => {
    const fetchLabelsEffect = Effect.gen(function* () {
      yield* Effect.logInfo('Fetching labels list')

      const response = yield* Effect.promise(() => get('/content/labels'))

      yield* Effect.logInfo('Labels response received', {
        status: response.status,
        ok: response.ok
      })

      const labelsData = yield* Effect.promise(() =>
        parseJsonResponse<Label[]>(response)
      )

      yield* Effect.logInfo('Labels parsed successfully', {
        count: labelsData.length
      })

      return labelsData
    })

    Runtime.runPromise(Runtime.defaultRuntime)(fetchLabelsEffect)
      .then((labelsData) => {
        console.log('Labels loaded:', labelsData)
        setLabels(labelsData)
        setIsLoadingLabels(false)

        if (labelsData.length === 0) {
          showToast({
            style: Toast.Style.Animated,
            title: 'No labels found',
            message: 'Create a label first to edit'
          })
        }
      })
      .catch((error) => {
        console.error('Failed to load labels:', error)
        showToast({
          style: Toast.Style.Failure,
          title: 'Failed to load labels',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
        setIsLoadingLabels(false)
      })
  }, [])

  useEffect(() => {
    if (!selectedLabelSlug) return

    const fetchLabelEffect = Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        get(`/content/labels/${selectedLabelSlug}`)
      )
      const label = yield* Effect.promise(() =>
        parseJsonResponse<Label>(response)
      )
      return label
    })

    Runtime.runPromise(Runtime.defaultRuntime)(fetchLabelEffect)
      .then((label) => {
        setFormData({
          title: label.title,
          description: label.description || '',
          thumbnailUrl: label.thumbnailUrl || '',
          slug: label.slug,
          content: label.content,
          website: label.website || '',
          bandcamp: label.bandcamp || '',
          discogs: label.discogs || '',
          genres: label.genres || [],
          draft: label.draft
        })
      })
      .catch((error) => {
        showToast({
          style: Toast.Style.Failure,
          title: 'Failed to load label',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      })
  }, [selectedLabelSlug])

  const handleSubmit = async (values: LabelFormData) => {
    if (!selectedLabelSlug) {
      showToast({
        style: Toast.Style.Failure,
        title: 'Error',
        message: 'Please select a label to edit'
      })
      return
    }

    setIsLoading(true)

    const updateLabelEffect = Effect.gen(function* () {
      yield* Effect.logInfo('Starting label update process', {
        slug: selectedLabelSlug
      })

      const cleanedValues = stripEmptyValues(values)

      yield* Effect.logDebug('Cleaned values for update', {
        originalKeys: Object.keys(values),
        cleanedKeys: Object.keys(cleanedValues)
      })

      const response = yield* Effect.promise(() =>
        patch(`/content/labels/${selectedLabelSlug}`, cleanedValues)
      )

      const result = yield* Effect.promise(() =>
        parseJsonResponse<Label>(response)
      )

      yield* Effect.logInfo('Label updated successfully', {
        labelId: result.id,
        title: result.title
      })

      yield* Effect.promise(() =>
        showToast({
          style: Toast.Style.Success,
          title: 'Label Updated',
          message: `Label "${result.title}" updated successfully`
        })
      )

      return result
    })

    try {
      await Runtime.runPromise(Runtime.defaultRuntime)(updateLabelEffect)
      // popToRoot()
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to update label'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title='Update Label'
            onSubmit={handleSubmit}
            icon='✏️'
          />
        </ActionPanel>
      }
      isLoading={isLoading || isLoadingLabels}>
      <Form.Dropdown
        id='labelSelect'
        title='Select Label'
        value={selectedLabelSlug}
        onChange={setSelectedLabelSlug}>
        {labels.length === 0 ? (
          <Form.Dropdown.Item
            value=''
            title='No labels found - Create one first'
          />
        ) : (
          <>
            <Form.Dropdown.Item value='' title='Choose a label...' />
            {labels.map((label) => (
              <Form.Dropdown.Item
                key={label.id}
                value={label.slug}
                title={label.title}
              />
            ))}
          </>
        )}
      </Form.Dropdown>

      {selectedLabelSlug && (
        <>
          <Form.TextField
            id='title'
            title='Label Name'
            placeholder='Enter label name'
            value={formData.title}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, title: value }))
            }
          />

          <Form.TextField
            id='slug'
            title='Slug'
            placeholder='URL-friendly slug'
            value={formData.slug}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, slug: value }))
            }
          />

          <Form.TextArea
            id='description'
            title='Description'
            placeholder='Short description of the label'
            value={formData.description ?? ''}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, description: value }))
            }
          />

          <Form.TextField
            id='thumbnailUrl'
            title='Thumbnail URL'
            placeholder='URL to label logo/artwork'
            value={formData.thumbnailUrl ?? ''}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, thumbnailUrl: value }))
            }
          />

          <Form.TextField
            id='website'
            title='Website'
            placeholder='https://label-website.com'
            value={formData.website ?? ''}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, website: value }))
            }
          />

          <Form.TextField
            id='bandcamp'
            title='Bandcamp'
            placeholder='https://label.bandcamp.com'
            value={formData.bandcamp ?? ''}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, bandcamp: value }))
            }
          />

          <Form.TextField
            id='discogs'
            title='Discogs'
            placeholder='https://www.discogs.com/label/...'
            value={formData.discogs ?? ''}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, discogs: value }))
            }
          />

          <Form.TagPicker
            id='genres'
            title='Genres'
            placeholder='Add genres'
            value={formData.genres ?? []}
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
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, draft: value }))
            }
          />
        </>
      )}
    </Form>
  )
}
