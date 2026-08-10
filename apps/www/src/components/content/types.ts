import type {
  SelectMdxCompiledEditorialPost,
  SelectMdxCompiledMicroPost
} from '@gbfm/server/schemas'

export type ContentScope = 'all' | 'mine'

export const PAGE_SIZE = 25

const contentTabs = { mixes: true, editorial: true, tweet: true }

export type ContentTab = keyof typeof contentTabs

export function isContentTab(value: string): value is ContentTab {
  return value in contentTabs
}

export type ContentView = {
  tab: ContentTab
  offset: number
  sort: 'plays' | 'created'
  order: 'asc' | 'desc'
}

export const defaultContentView: ContentView = {
  tab: 'mixes',
  offset: 0,
  sort: 'created',
  order: 'desc'
}

export interface AudioItem {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  slug: string
  content: string
  draft: boolean
  type: string
  url: string
  showId: string | null
  episodeNumber: number | null
  createdAt: string
  playCount: number
  tags?: string[] | null
  creators?: Array<{ id: string; name: string }>
}

export type EditorialPostItem = Omit<
  SelectMdxCompiledEditorialPost,
  'createdAt' | 'updatedAt' | 'creators'
> & {
  createdAt: string
  creators?: Array<{ id: string; name: string }>
}

export type TweetPostItem = Omit<
  SelectMdxCompiledMicroPost,
  'createdAt' | 'updatedAt' | 'creators'
> & {
  createdAt: string
  creators?: Array<{ id: string; name: string }>
}

export type PostListItem = {
  id: string
  title: string | null
  description: string | null
  thumbnailUrl: string | null
  slug: string
  content: string | null
  draft: boolean
  type: 'post' | 'micro' | null
  tags?: string[] | null
  creators?: Array<{ id: string; name: string }>
  createdAt: string
  blueskySource?: { publicUrl: string }
}

export interface AudioEditValues {
  title: string
  description: string
  slug: string
  content: string
  thumbnailUrl: string
  url: string
  tags: string[]
  draft: boolean
  episodeNumber: string
}

export interface PostEditValues {
  title: string
  description: string
  slug: string
  content: string
  thumbnailUrl: string
  tags: string[]
  draft: boolean
}

export interface EditDialogState {
  open: boolean
  mix: AudioItem | null
  values: AudioEditValues
}

export interface PostEditDialogState {
  open: boolean
  post: PostListItem | null
  values: PostEditValues
  type: 'post' | 'micro'
}

export const emptyAudioEditValues: AudioEditValues = {
  title: '',
  description: '',
  slug: '',
  content: '',
  thumbnailUrl: '',
  url: '',
  tags: [],
  draft: false,
  episodeNumber: ''
}

export const emptyPostEditValues: PostEditValues = {
  title: '',
  description: '',
  slug: '',
  content: '',
  thumbnailUrl: '',
  tags: [],
  draft: false
}

export function toAudioEditValues(mix: AudioItem): AudioEditValues {
  return {
    title: mix.title || '',
    description: mix.description || '',
    slug: mix.slug || '',
    content: mix.content || '',
    thumbnailUrl: mix.thumbnailUrl || '',
    url: mix.url || '',
    tags: mix.tags || [],
    draft: mix.draft ?? false,
    episodeNumber: mix.episodeNumber ? String(mix.episodeNumber) : ''
  }
}

export function toPostEditValues(post: PostListItem): PostEditValues {
  return {
    title: post.title || '',
    description: post.description || '',
    slug: post.slug || '',
    content: post.content || '',
    thumbnailUrl: post.thumbnailUrl || '',
    tags: post.tags || [],
    draft: post.draft ?? false
  }
}
