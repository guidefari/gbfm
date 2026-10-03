import * as Dialog from '@foldkit/ui/dialog'
import type { Update } from 'foldkit'

import { Hydrate } from './command'
import type { Message } from './message'
import { keyOf, type Model } from './model'
import type { CreatorKind, CreatorService } from './services'

export interface InitInput {
  readonly kind: CreatorKind
  readonly editSlug: string | null
  readonly creatorId: string
  readonly authorized: boolean
}

export const initialModel = ({ kind, editSlug, creatorId, authorized }: InitInput): Model => ({
  reviewDialog: Dialog.init({ id: 'publish-review' }),
  draft: {
    kind,
    editSlug,
    title: '',
    slug: '',
    content: '',
    description: '',
    tags: [],
    creatorIds: [creatorId],
    thumbnailUrl: '',
    musicUrl: '',
    musicEntityType: null,
    musicEntityId: null,
    quotedPostId: null,
    quoteUrl: '',
    audioUrl: '',
    showId: null,
    episodeNumber: null,
  },
  creatorId,
  authorized,
  phase: authorized ? 'loading' : 'forbidden',
  saveState: 'saved',
  error: null,
  episodeError: null,
  tagsInput: '',
  creatorsInput: creatorId,
  episodeInput: '',
  editorMode: 'source',
  externalMediaUrl: '',
  musicPreviewTitle: null,
  musicPreviewMeta: null,
  musicPreviewImage: null,
  quotePreview: null,
  uploadPercent: 0,
  uploadState: 'idle',
})

export const init = (input: InitInput): Update.Return<Model, Message, CreatorService> => {
  const model = initialModel(input)

  return input.authorized
    ? {
        model,
        commands: [
          Hydrate({ key: keyOf(model.draft), kind: input.kind, editSlug: input.editSlug }),
        ],
      }
    : { model }
}
