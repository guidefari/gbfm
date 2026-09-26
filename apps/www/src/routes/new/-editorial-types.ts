export interface EditorialPost {
  id: string
  title: string | null
  description: string | null
  slug: string
  content: string | null
  thumbnailUrl: string | null
  tags: Array<string> | null
  draft: boolean
  type: 'post' | 'micro' | null
  creators?: Array<EditorialCreator>
}

export interface EditorialCreator {
  id: string
  name: string
}

export interface EditorialFormData {
  title: string
  description: string
  slug: string
  content: string
  thumbnailUrl: string
  tags: Array<string>
  draft: boolean
}

export type EditorialField = keyof EditorialFormData

export type EditorialTextField = Exclude<EditorialField, 'draft'>

export type EditorialSaveState = 'saved' | 'unsaved' | 'uploading' | 'saving' | 'error'
