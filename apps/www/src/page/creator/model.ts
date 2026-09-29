import { Schema } from 'effect'

import type { CreatorDraft } from './services'
import { CreatorDraftSchema as Draft } from './services'

export const Kind = Schema.Literals(['micro', 'post', 'mix'])

export const Model = Schema.Struct({
  draft: Draft,
  creatorId: Schema.String,
  authorized: Schema.Boolean,
  phase: Schema.Literals([
    'loading',
    'writing',
    'reviewing',
    'saving',
    'uploading',
    'published',
    'forbidden',
  ]),
  saveState: Schema.Literals(['saved', 'unsaved', 'saved-locally', 'failed']),
  error: Schema.NullOr(Schema.String),
  episodeError: Schema.NullOr(Schema.String),
  tagsInput: Schema.String,
  creatorsInput: Schema.String,
  episodeInput: Schema.String,
  uploadPercent: Schema.Number,
  uploadState: Schema.Literals(['idle', 'running', 'pausing', 'paused', 'failed', 'cancelling']),
})

export type Model = typeof Model.Type

export const keyOf = (draft: CreatorDraft) => `${draft.kind}:${draft.editSlug ?? 'new'}`
