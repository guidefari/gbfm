import type { Update } from 'foldkit'

import {
  CancelUpload,
  PauseUpload,
  PersistDraft,
  ResolveMusic,
  Save,
  UploadArtwork,
  UploadAudio,
} from './command'
import { Message } from './message'
import { keyOf, type Model } from './model'
import type { CreatorDraft, CreatorService } from './services'
import type { CreatorUpload } from './upload/runtime'

const changed = (
  model: Model,
  draft: CreatorDraft,
): Update.Return<Model, Message, CreatorService> => ({
  model: { ...model, draft, saveState: 'unsaved', error: null },
  commands: [PersistDraft({ key: keyOf(draft), draft })],
})

export const update = (
  model: Model,
  message: Message,
): Update.Return<Model, Message, CreatorService | CreatorUpload> =>
  Message.match<Update.Return<Model, Message, CreatorService | CreatorUpload>>(message, {
    Changed: ({ field, value }) => changed(model, { ...model.draft, [field]: value }),
    CreatorsChanged: ({ value }) =>
      changed(
        { ...model, creatorsInput: value },
        {
          ...model.draft,
          creatorIds: [
            ...new Set(
              value
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean),
            ),
          ],
        },
      ),
    QuoteChanged: ({ value }) =>
      model.draft.editSlug
        ? { model }
        : changed(model, { ...model.draft, quotedPostId: value.trim() || null }),
    ShowChanged: ({ value }) => changed(model, { ...model.draft, showId: value.trim() || null }),
    EpisodeChanged: ({ value }) => {
      const episodeNumber = value.trim() ? Number(value) : null

      return episodeNumber !== null && (!Number.isSafeInteger(episodeNumber) || episodeNumber < 1)
        ? {
            model: {
              ...model,
              episodeInput: value,
              episodeError: 'Episode number must be a positive whole number.',
            },
          }
        : changed(
            { ...model, episodeInput: value, episodeError: null },
            { ...model.draft, episodeNumber },
          )
    },
    MusicRemoved: () =>
      changed(model, { ...model.draft, musicUrl: '', musicEntityType: null, musicEntityId: null }),
    TagsChanged: ({ value }) =>
      changed(
        { ...model, tagsInput: value },
        {
          ...model.draft,
          tags: [
            ...new Set(
              value
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
            ),
          ],
        },
      ),
    KindChanged: ({ kind }) =>
      model.draft.editSlug ? { model } : changed(model, { ...model.draft, kind }),
    ReviewRequested: () => ({ model: { ...model, phase: 'reviewing' } }),
    ReviewClosed: () => ({ model: { ...model, phase: 'writing' } }),
    ResolveMusicRequested: () => ({
      model: { ...model, error: null },
      commands: [ResolveMusic({ url: model.draft.musicUrl.trim(), kind: model.draft.kind })],
    }),
    MusicResolved: ({ entityType, entityId, url }) =>
      model.draft.musicUrl.trim() !== url
        ? { model }
        : changed(model, { ...model.draft, musicEntityType: entityType, musicEntityId: entityId }),
    DraftSaveRequested: () =>
      model.draft.kind === 'mix' && model.episodeError
        ? { model }
        : model.authorized
          ? {
              model: { ...model, phase: 'saving' },
              commands: [Save({ draft: model.draft, creatorId: model.creatorId, publish: false })],
            }
          : { model: { ...model, phase: 'forbidden' } },
    PublishRequested: () =>
      model.draft.kind === 'mix' && model.episodeError
        ? { model }
        : model.authorized
          ? {
              model: { ...model, phase: 'saving' },
              commands: [Save({ draft: model.draft, creatorId: model.creatorId, publish: true })],
            }
          : { model: { ...model, phase: 'forbidden' } },
    Saved: ({ slug, published }) => ({
      model: {
        ...model,
        draft: { ...model.draft, slug, editSlug: slug },
        phase: published ? 'published' : 'writing',
        saveState: 'saved',
        error: null,
      },
    }),
    Failed: ({ operation, message }) => ({
      model: { ...model, phase: 'writing', saveState: 'failed', error: `${operation}: ${message}` },
    }),
    Hydrated: ({ draft }) => ({
      model: {
        ...model,
        draft: draft ?? model.draft,
        tagsInput: (draft ?? model.draft).tags.join(', '),
        creatorsInput: (draft ?? model.draft).creatorIds.join(', '),
        episodeInput: (draft ?? model.draft).episodeNumber?.toString() ?? '',
        phase: 'writing',
        saveState: draft ? 'saved-locally' : model.saveState,
      },
    }),
    LocallySaved: () => ({
      model:
        model.phase === 'saving' || model.phase === 'published'
          ? model
          : { ...model, saveState: 'saved-locally' },
    }),
    ArtworkChosen: ({ files }) =>
      files[0]
        ? { model: { ...model, phase: 'uploading' }, commands: [UploadArtwork({ file: files[0] })] }
        : { model },
    ArtworkUploaded: ({ url }) =>
      changed({ ...model, phase: 'writing' }, { ...model.draft, thumbnailUrl: url }),
    AudioChosen: ({ files }) =>
      files[0] && model.uploadState === 'idle'
        ? {
            model: {
              ...model,
              phase: 'uploading',
              uploadState: 'running',
              uploadPercent: 0,
              error: null,
            },
            commands: [UploadAudio({ file: files[0] })],
          }
        : { model },
    AudioUploaded: ({ url }) =>
      changed(
        { ...model, phase: 'writing', uploadState: 'idle', uploadPercent: 100 },
        { ...model.draft, audioUrl: url },
      ),
    UploadProgressed: ({ percent }) => ({
      model:
        model.uploadState === 'running' || model.uploadState === 'pausing'
          ? { ...model, uploadPercent: percent }
          : model,
    }),
    UploadPauseRequested: () =>
      model.uploadState === 'running'
        ? { model: { ...model, uploadState: 'pausing' }, commands: [PauseUpload()] }
        : { model },
    UploadPauseAcknowledged: () => ({ model }),
    UploadPaused: ({ percent }) => ({
      model: { ...model, phase: 'writing', uploadState: 'paused', uploadPercent: percent },
    }),
    UploadResumeRequested: () =>
      model.uploadState === 'paused' || model.uploadState === 'failed'
        ? {
            model: { ...model, phase: 'uploading', uploadState: 'running', error: null },
            commands: [UploadAudio({ file: null })],
          }
        : { model },
    UploadCancelRequested: () =>
      model.uploadState === 'paused' || model.uploadState === 'failed'
        ? { model: { ...model, uploadState: 'cancelling' }, commands: [CancelUpload()] }
        : { model },
    UploadCancelled: () => ({
      model: { ...model, phase: 'writing', uploadState: 'idle', uploadPercent: 0, error: null },
    }),
    UploadFailed: ({ message }) => ({
      model: { ...model, phase: 'writing', uploadState: 'failed', error: message },
    }),
    UploadUnavailable: ({ message }) => ({
      model: { ...model, phase: 'writing', uploadState: 'idle', error: message },
    }),
  })
