import {
  Action,
  ActionPanel,
  Detail,
  Form,
  Icon,
  List,
  popToRoot,
  showToast,
  Toast,
  useNavigation
} from '@raycast/api'
import { Effect, Runtime } from 'effect'
import { useEffect, useState } from 'react'
import { get, parseJsonResponse, post } from './api-client'

interface ReleaseFormData {
  title: string
  description: string
  thumbnailUrl: string
  slug: string
  content: string
  labelId: string
  releaseDate: string
  streamingLinks: Array<{ platform: string; url: string }>
  draft: boolean
}

interface Label {
  id: string
  title: string
  slug: string
}

interface AlbumSearchResult {
  id: string
  title: string
  artists: string
  albumType: string
  releaseDate: string
  albumImageUrl?: string
  albumUrl: string
  totalTracks: number
}

const STREAMING_PLATFORMS = [
  { value: 'spotify', title: 'Spotify', icon: '🎵' },
  { value: 'apple-music', title: 'Apple Music', icon: '🍎' },
  { value: 'youtube', title: 'YouTube', icon: '📺' },
  { value: 'bandcamp', title: 'Bandcamp', icon: '🎸' },
  { value: 'soundcloud', title: 'SoundCloud', icon: '☁️' },
  { value: 'tidal', title: 'Tidal', icon: '🌊' },
  { value: 'deezer', title: 'Deezer', icon: '🎧' },
  { value: 'amazon-music', title: 'Amazon Music', icon: '📦' }
] as const

function getPlatformIcon(platform: string): string {
  const found = STREAMING_PLATFORMS.find(
    (p) => p.value === platform.toLowerCase().replace(/\s+/g, '-')
  )
  return found?.icon || '🔗'
}

function generateSlugFromTitle(title: string): string {
  if (!title) return ''
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function SpotifySearch({
  onSelect
}: {
  onSelect: (album: AlbumSearchResult) => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<AlbumSearchResult[]>([])
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumSearchResult | null>(
    null
  )
  const { pop } = useNavigation()

  useEffect(() => {
    const searchAlbums = async () => {
      if (!searchQuery.trim()) {
        setResults([])
        return
      }

      setIsSearching(true)
      try {
        const response = await post('/spotify/search/albums', {
          query: searchQuery,
          limit: 20
        })
        const data = await parseJsonResponse<{ albums: AlbumSearchResult[] }>(
          response
        )
        setResults(data.albums)
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: 'Search Error',
          message:
            error instanceof Error ? error.message : 'Failed to search albums'
        })
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }

    searchAlbums()
  }, [searchQuery])

  const handleSelect = (album: AlbumSearchResult) => {
    setSelectedAlbum(album)
  }

  const handleConfirm = () => {
    if (selectedAlbum) {
      onSelect(selectedAlbum)
      pop()
    }
  }

  const markdown = selectedAlbum
    ? `
# ${selectedAlbum.title}

**${selectedAlbum.artists}**

![Album Art](${selectedAlbum.albumImageUrl || ''})

---

**Type**: ${selectedAlbum.albumType}
**Release Date**: ${selectedAlbum.releaseDate}
**Tracks**: ${selectedAlbum.totalTracks}

[Open on Spotify ↗](${selectedAlbum.albumUrl})

---

## What will be imported:

**Title**: ${selectedAlbum.title}
**Slug**: ${generateSlugFromTitle(selectedAlbum.title)}
**Description**: ${selectedAlbum.artists} - ${selectedAlbum.albumType}
**Release Date**: ${selectedAlbum.releaseDate}
**Artwork URL**: ${selectedAlbum.albumImageUrl || 'Not available'}
**Spotify Link**: ${selectedAlbum.albumUrl}

All fields will be editable after import.
`
    : '# No album selected\n\nSearch for an album using the form on the left.'

  if (selectedAlbum) {
    return (
      <Detail
        markdown={markdown}
        actions={
          <ActionPanel>
            <Action
              title='Use This Album'
              icon={Icon.Check}
              onAction={handleConfirm}
            />
            <Action
              title='Search Again'
              icon={Icon.MagnifyingGlass}
              onAction={() => setSelectedAlbum(null)}
            />
          </ActionPanel>
        }
      />
    )
  }

  return (
    <List
      isLoading={isSearching}
      onSearchTextChange={setSearchQuery}
      searchBarPlaceholder='Search for albums by artist or name...'
      throttle>
      {results.length === 0 && searchQuery.trim() === '' ? (
        <List.EmptyView
          title='Search for Albums'
          description='Start typing to search Spotify'
          icon={Icon.MagnifyingGlass}
        />
      ) : results.length === 0 && searchQuery.trim() !== '' ? (
        <List.EmptyView
          title='No Results'
          description={`No albums found for "${searchQuery}"`}
          icon={Icon.XMarkCircle}
        />
      ) : (
        results.map((album) => (
          <List.Item
            key={album.id}
            title={album.title}
            subtitle={album.artists}
            icon={{ source: album.albumImageUrl || Icon.Music }}
            accessories={[
              { text: album.albumType },
              { text: album.releaseDate }
            ]}
            actions={
              <ActionPanel>
                <Action
                  title='Select Album'
                  icon={Icon.Check}
                  onAction={() => handleSelect(album)}
                />
                <Action.OpenInBrowser url={album.albumUrl} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  )
}

export default function CreateRelease() {
  const [labels, setLabels] = useState<Label[]>([])
  const [isLoadingLabels, setIsLoadingLabels] = useState(true)
  const [formData, setFormData] = useState<ReleaseFormData>({
    title: '',
    description: '',
    thumbnailUrl: '',
    slug: '',
    content: '',
    labelId: '',
    releaseDate: new Date().toISOString(),
    streamingLinks: [],
    draft: true
  })
  const [streamingLinkInputs, setStreamingLinkInputs] = useState<
    Array<{ platform: string; url: string }>
  >([{ platform: '', url: '' }])
  const [isLoading, setIsLoading] = useState(false)
  const { push } = useNavigation()

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const response = await get('/content/labels')
        const labelsData = await parseJsonResponse<Label[]>(response)
        setLabels(labelsData)
      } catch (_error) {
        await showToast({
          style: Toast.Style.Failure,
          title: 'Error',
          message: 'Failed to fetch labels'
        })
      } finally {
        setIsLoadingLabels(false)
      }
    }

    fetchLabels()
  }, [])

  const handleSpotifySelect = (album: AlbumSearchResult) => {
    setFormData((prev) => ({
      ...prev,
      title: album.title,
      slug: generateSlugFromTitle(album.title),
      thumbnailUrl: album.albumImageUrl || '',
      releaseDate: album.releaseDate,
      description: `${album.artists} - ${album.albumType}`,
      content: `# ${album.title}\n\nBy ${album.artists}\n\nReleased: ${album.releaseDate}\nTracks: ${album.totalTracks}`
    }))

    setStreamingLinkInputs([{ platform: 'spotify', url: album.albumUrl }])

    showToast({
      style: Toast.Style.Success,
      title: 'Album Data Imported',
      message: `Imported metadata for "${album.title}"`
    })
  }

  const handleSubmit = async (values: ReleaseFormData) => {
    setIsLoading(true)

    const createReleaseEffect = Effect.gen(function* () {
      yield* Effect.logInfo('Starting release creation process', {
        title: values.title
      })

      const validStreamingLinks = streamingLinkInputs.filter(
        (link) => link.platform && link.url
      )

      const requestBody = {
        ...values,
        streamingLinks:
          validStreamingLinks.length > 0 ? validStreamingLinks : undefined
      }

      yield* Effect.logDebug('Preparing to create release', {
        title: values.title,
        slug: values.slug,
        labelId: values.labelId
      })

      const response = yield* Effect.promise(() =>
        post('/content/releases', requestBody)
      )

      const result = yield* Effect.promise(() =>
        parseJsonResponse<{
          id: string
          title: string
          slug: string
        }>(response)
      )

      yield* Effect.logInfo('Release created successfully', {
        releaseId: result.id,
        title: result.title,
        slug: result.slug
      })

      yield* Effect.promise(() =>
        showToast({
          style: Toast.Style.Success,
          title: 'Release Created',
          message: `Release "${result.title}" created successfully`
        })
      )

      return result
    })

    try {
      await Runtime.runPromise(Runtime.defaultRuntime)(createReleaseEffect)
      popToRoot()
    } catch (error) {
      await Runtime.runPromise(Runtime.defaultRuntime)(
        Effect.logError('Release creation failed with unhandled error', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
      )

      await showToast({
        style: Toast.Style.Failure,
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to create release'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateStreamingLink = (
    index: number,
    field: 'platform' | 'url',
    value: string
  ) => {
    const updated = [...streamingLinkInputs]
    updated[index][field] = value
    setStreamingLinkInputs(updated)
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title='Create Release'
            onSubmit={handleSubmit}
            icon='✨'
          />
          <Action
            title='Search Spotify'
            icon={Icon.MagnifyingGlass}
            shortcut={{ modifiers: ['cmd'], key: 's' }}
            onAction={() =>
              push(<SpotifySearch onSelect={handleSpotifySelect} />)
            }
          />
          <Action
            title='Add Streaming Link'
            icon={Icon.Plus}
            shortcut={{ modifiers: ['cmd'], key: 'n' }}
            onAction={() =>
              setStreamingLinkInputs([
                ...streamingLinkInputs,
                { platform: '', url: '' }
              ])
            }
          />
        </ActionPanel>
      }
      isLoading={isLoading || isLoadingLabels}>
      <Form.Dropdown
        id='labelId'
        title='Label'
        value={formData.labelId}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, labelId: value }))
        }
        isLoading={isLoadingLabels}>
        <Form.Dropdown.Item value='' title='Select a label' />
        {labels.map((label) => (
          <Form.Dropdown.Item
            key={label.id}
            value={label.id}
            title={label.title}
          />
        ))}
      </Form.Dropdown>

      <Form.TextField
        id='title'
        title='Release Title'
        placeholder='Enter release title or search Spotify (Cmd+S)'
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
        placeholder='URL-friendly slug (auto-generated from title)'
        value={formData.slug}
        onChange={(value) => setFormData((prev) => ({ ...prev, slug: value }))}
      />

      <Form.DatePicker
        id='releaseDate'
        title='Release Date'
        value={
          formData.releaseDate ? new Date(formData.releaseDate) : undefined
        }
        onChange={(value) =>
          setFormData((prev) => ({
            ...prev,
            releaseDate: value ? value.toISOString() : ''
          }))
        }
      />

      <Form.TextArea
        id='description'
        title='Description'
        placeholder='Short description of the release'
        value={formData.description}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, description: value }))
        }
      />

      <Form.TextField
        id='thumbnailUrl'
        title='Artwork URL'
        placeholder='URL to release artwork'
        value={formData.thumbnailUrl}
        onChange={(value) =>
          setFormData((prev) => ({ ...prev, thumbnailUrl: value }))
        }
      />

      <Form.Separator />

      {streamingLinkInputs.map((link, index) => (
        <>
          <Form.Dropdown
            key={`${link.platform || 'new'}-platform-${index}`}
            id={`platform-${index}`}
            title={`${getPlatformIcon(link.platform)} Platform ${index + 1}`}
            value={link.platform}
            onChange={(value) => updateStreamingLink(index, 'platform', value)}>
            <Form.Dropdown.Item value='' title='Select platform' />
            {STREAMING_PLATFORMS.map((platform) => (
              <Form.Dropdown.Item
                key={platform.value}
                value={platform.value}
                title={`${platform.icon} ${platform.title}`}
              />
            ))}
          </Form.Dropdown>
          <Form.TextField
            key={`${link.platform || 'new'}-url-${index}`}
            id={`url-${index}`}
            title={`URL ${index + 1}`}
            placeholder='https://...'
            value={link.url}
            onChange={(value) => updateStreamingLink(index, 'url', value)}
          />
        </>
      ))}

      <Form.Separator />

      <Form.TextArea
        id='content'
        title='Content'
        placeholder='Release notes/description in markdown format'
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
