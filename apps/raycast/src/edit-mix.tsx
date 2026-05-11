import {
  Action,
  ActionPanel,
  Form,
  List,
  popToRoot,
  showToast,
  Toast
} from '@raycast/api'
import { Effect } from 'effect'
import { useEffect, useState } from 'react'
import { get, parseJsonResponse, patch } from './api-client'
import { extractTracklistAsJSXEffect } from './util'

interface Mix {
  id: string
  title: string
  slug: string
  description: string
  url: string
  thumbnailUrl: string
  tags: string[]
  content: string
  draft: boolean
  type: 'mix'
  creators?: Array<{
    id: string
    name: string
    username: string
  }>
}

interface PaginationMetadata {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMetadata
}

interface EditFormData {
  title: string
  description: string
  thumbnailUrl: string
  slug: string
  url: string
  tags: string[]
  content: string
  tracklist: string
  draft: boolean
}

function MixSearchList({ onSelectMix }: { onSelectMix: (mix: Mix) => void }) {
  const [mixes, setMixes] = useState<Mix[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    loadMixes()
  }, [])

  const loadMixes = async () => {
    try {
      // Load all pages of mixes
      let allMixes: Mix[] = []
      let offset = 0
      const limit = 20
      let hasMore = true

      while (hasMore) {
        const response = await get(
          `/content/audio/mix?limit=${limit}&offset=${offset}`
        )
        const page = await parseJsonResponse<PaginatedResponse<Mix>>(response)
        allMixes = [...allMixes, ...page.data]
        hasMore = page.pagination.hasMore
        offset += limit
      }

      setMixes(allMixes)
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to load mixes'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredMixes = mixes.filter(
    (mix) =>
      mix.title.toLowerCase().includes(searchText.toLowerCase()) ||
      mix.slug.toLowerCase().includes(searchText.toLowerCase())
  )

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder='Search mixes by title or slug...'>
      {filteredMixes.map((mix) => (
        <List.Item
          key={mix.id}
          title={mix.title}
          subtitle={`slug: ${mix.slug}`}
          accessories={[
            { text: mix.draft ? 'Draft' : 'Published' },
            { text: mix.tags?.join(', ') || '' }
          ]}
          actions={
            <ActionPanel>
              <Action
                title='Edit This Mix'
                onAction={() => onSelectMix(mix)}
                icon='✏️'
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  )
}

function MixEditForm({ mix }: { mix: Mix }) {
  const [formData, setFormData] = useState<EditFormData>({
    title: mix.title,
    description: mix.description,
    thumbnailUrl: mix.thumbnailUrl,
    slug: mix.slug,
    url: mix.url,
    tags: mix.tags || [],
    content: mix.content,
    tracklist: '',
    draft: mix.draft
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (values: EditFormData) => {
    setIsLoading(true)

    const updateMixEffect = Effect.gen(function* () {
      yield* Effect.logInfo('Starting mix update process', {
        title: values.title,
        slug: mix.slug
      })

      const processedTracklist = yield* extractTracklistAsJSXEffect(
        values.tracklist
      ).pipe(
        Effect.catch((error) =>
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

      yield* Effect.logDebug('Preparing to update mix', {
        title: values.title,
        slug: mix.slug,
        hasContent: !!finalContent
      })

      const requestBody = {
        ...submitData,
        content: finalContent,
        tags: submitData.tags.filter((tag) => tag.trim() !== '')
      }

      const response = yield* Effect.promise(() =>
        patch(`/content/audio/mix/${mix.slug}`, requestBody)
      )

      const result = yield* Effect.promise(() =>
        parseJsonResponse<Mix>(response)
      )

      yield* Effect.logInfo('Mix updated successfully', {
        mixId: result.id,
        title: result.title,
        slug: result.slug
      })

      yield* Effect.promise(() =>
        showToast({
          style: Toast.Style.Success,
          title: 'Mix Updated',
          message: `Mix "${result.title}" updated successfully`
        })
      )

      return result
    })

    try {
      await Effect.runPromise(updateMixEffect)
      popToRoot()
    } catch (error) {
      await Effect.runPromise(
        Effect.logError('Mix update failed with unhandled error', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
      )

      await showToast({
        style: Toast.Style.Failure,
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update mix'
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
            title='Update Mix'
            onSubmit={handleSubmit}
            icon='💾'
          />
        </ActionPanel>
      }
      isLoading={isLoading}>
      <Form.Description
        title='Editing Mix'
        text={`ID: ${mix.id} | Original Slug: ${mix.slug}`}
      />

      <Form.Separator />

      <Form.TextField
        id='title'
        title='Title'
        placeholder='Enter mix title'
        value={formData.title}
        onChange={(value) => setFormData((prev) => ({ ...prev, title: value }))}
      />

      <Form.TextField
        id='slug'
        title='Slug'
        placeholder='URL-friendly slug'
        value={formData.slug}
        onChange={(value) => setFormData((prev) => ({ ...prev, slug: value }))}
        info='⚠️ Changing the slug will change the URL'
      />

      <Form.TextArea
        id='description'
        title='Description'
        placeholder='Enter mix description'
        value={formData.description}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, description: value }))
        }
      />

      <Form.TextField
        id='url'
        title='Audio URL'
        placeholder='Direct URL to the audio file'
        value={formData.url}
        onChange={(value) => setFormData((prev) => ({ ...prev, url: value }))}
      />

      <Form.TextField
        id='thumbnailUrl'
        title='Thumbnail URL'
        placeholder='URL to cover image/thumbnail'
        value={formData.thumbnailUrl}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, thumbnailUrl: value }))
        }
      />

      <Form.TagPicker
        id='tags'
        title='Tags'
        placeholder='Add or modify tags'
        value={formData.tags}
        onChange={(value) => setFormData((prev) => ({ ...prev, tags: value }))}>
        <Form.TagPicker.Item value='house' title='House' />
        <Form.TagPicker.Item value='techno' title='Techno' />
        <Form.TagPicker.Item value='deep-house' title='Deep House' />
        <Form.TagPicker.Item value='progressive' title='Progressive' />
        <Form.TagPicker.Item value='ambient' title='Ambient' />
        <Form.TagPicker.Item value='minimal' title='Minimal' />
        <Form.TagPicker.Item value='trance' title='Trance' />
      </Form.TagPicker>

      <Form.TextArea
        id='content'
        title='Content'
        placeholder='Mix description/tracklist in markdown format'
        value={formData.content}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, content: value }))
        }
      />

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
        title='Status'
        label='Save as draft'
        value={formData.draft}
        onChange={(value) => setFormData((prev) => ({ ...prev, draft: value }))}
      />
    </Form>
  )
}

interface EditMixProps {
  preselectedMix?: Mix
}

export default function EditMix({ preselectedMix }: EditMixProps = {}) {
  const [selectedMix, setSelectedMix] = useState<Mix | null>(
    preselectedMix || null
  )

  if (selectedMix) {
    return <MixEditForm mix={selectedMix} />
  }

  return <MixSearchList onSelectMix={setSelectedMix} />
}
