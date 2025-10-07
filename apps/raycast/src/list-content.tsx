import {
  Action,
  ActionPanel,
  List,
  LocalStorage,
  showToast,
  Toast
} from '@raycast/api'
import { useEffect, useState } from 'react'
import EditMix from './edit-mix'

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
  createdAt: string
  updatedAt: string
}

export default function ListContent() {
  const [mixes, setMixes] = useState<Mix[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    loadMixes()
  }, [])

  const loadMixes = async () => {
    try {
      const [baseUrl, accessToken] = await Promise.all([
        LocalStorage.getItem<string>('gbfm-base-url'),
        LocalStorage.getItem<string>('gbfm-access-token')
      ])

      if (!baseUrl || !accessToken) {
        await showToast({
          style: Toast.Style.Failure,
          title: 'Configuration Missing',
          message: 'Please configure API settings and sign in first'
        })
        return
      }

      const response = await fetch(`${baseUrl}/content/audio/mix`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch mixes: ${response.statusText}`)
      }

      const mixesData = (await response.json()) as Mix[]
      setMixes(mixesData)
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

  const refreshList = () => {
    setIsLoading(true)
    loadMixes()
  }

  const filteredMixes = mixes.filter(
    (mix) =>
      mix.title.toLowerCase().includes(searchText.toLowerCase()) ||
      mix.slug.toLowerCase().includes(searchText.toLowerCase()) ||
      mix.tags?.some((tag) =>
        tag.toLowerCase().includes(searchText.toLowerCase())
      )
  )

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder='Search mixes by title, slug, or tags...'>
      <List.Section title={`Mixes (${filteredMixes.length})`}>
        {filteredMixes.map((mix) => (
          <List.Item
            key={mix.id}
            title={mix.title}
            subtitle={mix.description}
            accessories={[
              { text: mix.draft ? 'Draft' : 'Published' },
              { text: mix.tags?.join(', ') || '' },
              { text: new Date(mix.createdAt).toLocaleDateString() }
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title='Edit Mix'
                  target={<EditMix preselectedMix={mix} />}
                  icon='✏️'
                />
                <Action
                  title='Refresh List'
                  onAction={refreshList}
                  icon='🔄'
                  shortcut={{ modifiers: ['cmd'], key: 'r' }}
                />
                <Action.OpenInBrowser
                  title='Preview Mix'
                  url={mix.url}
                  shortcut={{ modifiers: ['cmd'], key: 'o' }}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      {!isLoading && filteredMixes.length === 0 && (
        <List.EmptyView
          title='No Mixes Found'
          description={
            searchText
              ? 'No mixes match your search criteria'
              : 'No mixes available'
          }
          actions={
            <ActionPanel>
              <Action title='Refresh List' onAction={refreshList} icon='🔄' />
            </ActionPanel>
          }
        />
      )}
    </List>
  )
}
