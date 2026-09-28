import { Effect, Schema, Stream } from 'effect'
import { Command, Subscription, type Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'

import type { CreatorDraft, CreatorError, CreatorKind } from './services'
import { CreatorDraftSchema as Draft, CreatorService } from './services'
import { CreatorUpload } from './upload/runtime'

const Kind = Schema.Literals(['micro', 'post', 'mix'])

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

export const Message = defineMessageUnion({
  Changed: {
    field: Schema.Literals([
      'title',
      'slug',
      'content',
      'description',
      'musicUrl',
      'thumbnailUrl',
      'audioUrl',
    ]),
    value: Schema.String,
  },
  TagsChanged: { value: Schema.String },
  CreatorsChanged: { value: Schema.String },
  QuoteChanged: { value: Schema.String },
  ShowChanged: { value: Schema.String },
  EpisodeChanged: { value: Schema.String },
  MusicRemoved: {},
  KindChanged: { kind: Kind },
  ReviewRequested: {},
  ReviewClosed: {},
  ResolveMusicRequested: {},
  MusicResolved: {
    entityType: Schema.Literals(['album', 'track', 'playlist']),
    entityId: Schema.String,
    url: Schema.String,
  },
  PublishRequested: {},
  DraftSaveRequested: {},
  Saved: { slug: Schema.String, published: Schema.Boolean },
  Failed: { operation: Schema.String, message: Schema.String },
  Hydrated: { draft: Schema.NullOr(Draft) },
  LocallySaved: {},
  ArtworkChosen: { files: Schema.Array(Schema.instanceOf(File)) },
  ArtworkUploaded: { url: Schema.String },
  AudioChosen: { files: Schema.Array(Schema.instanceOf(File)) },
  AudioUploaded: { url: Schema.String },
  UploadProgressed: { percent: Schema.Number },
  UploadPauseRequested: {},
  UploadPauseAcknowledged: {},
  UploadPaused: { percent: Schema.Number },
  UploadResumeRequested: {},
  UploadCancelRequested: {},
  UploadCancelled: {},
  UploadFailed: { message: Schema.String },
  UploadUnavailable: { message: Schema.String },
})

export type Message = typeof Message.Type

const failure = (operation: string) => (error: CreatorError) =>
  Message.Failed({ operation, message: error.message })

const PersistDraft = Command.define('Creator.PersistDraft', {
  args: { key: Schema.String, draft: Draft },
  messages: [Message.LocallySaved, Message.Failed],
  execute: ({ key, draft }) =>
    Effect.flatMap(CreatorService, (service) => service.writeLocalDraft(key, draft)).pipe(
      Effect.as(Message.LocallySaved()),
      Effect.catch((error) => Effect.succeed(failure('autosave')(error))),
    ),
})

const Hydrate = Command.define('Creator.Hydrate', {
  args: { key: Schema.String, kind: Kind, editSlug: Schema.NullOr(Schema.String) },
  messages: [Message.Hydrated, Message.Failed],
  execute: ({ key, kind, editSlug }) =>
    Effect.gen(function* () {
      const service = yield* CreatorService

      const draft: CreatorDraft | null = editSlug
        ? yield* service.loadEditable(kind, editSlug)
        : yield* service.readLocalDraft(key)

      return Message.Hydrated({ draft })
    }).pipe(Effect.catch((error) => Effect.succeed(failure('load')(error)))),
})

const ResolveMusic = Command.define('Creator.ResolveMusic', {
  args: { url: Schema.String, kind: Kind },
  messages: [Message.MusicResolved, Message.Failed],
  execute: ({ url, kind }) =>
    Effect.flatMap(CreatorService, (service) => service.resolveMusic(url, kind)).pipe(
      Effect.map(({ entityType, entityId }) =>
        Message.MusicResolved({ entityType, entityId, url }),
      ),
      Effect.catch((error) => Effect.succeed(failure('resolve music')(error))),
    ),
})

const Save = Command.define('Creator.Save', {
  args: { draft: Draft, creatorId: Schema.String, publish: Schema.Boolean },
  messages: [Message.Saved, Message.Failed],
  execute: ({ draft, creatorId, publish }) =>
    Effect.gen(function* () {
      const service = yield* CreatorService
      const { slug } = yield* service.save({ draft, creatorId, publish })

      yield* service.clearLocalDraft(keyOf(draft))

      return Message.Saved({ slug, published: publish })
    }).pipe(Effect.catch((error) => Effect.succeed(failure('save')(error)))),
})

const UploadArtwork = Command.define('Creator.UploadArtwork', {
  args: { file: Schema.instanceOf(File) },
  messages: [Message.ArtworkUploaded, Message.Failed],
  execute: ({ file }) =>
    Effect.flatMap(CreatorService, (service) => service.uploadImage(file)).pipe(
      Effect.map((url) => Message.ArtworkUploaded({ url })),
      Effect.catch((error) => Effect.succeed(failure('artwork upload')(error))),
    ),
})

const UploadAudio = Command.define('Creator.UploadAudio', {
  args: { file: Schema.NullOr(Schema.instanceOf(File)) },
  messages: [
    Message.AudioUploaded,
    Message.UploadPaused,
    Message.UploadFailed,
    Message.UploadUnavailable,
  ],
  execute: ({ file }) =>
    Effect.flatMap(CreatorUpload, (service) => (file ? service.start(file) : service.resume)).pipe(
      Effect.map((url) => Message.AudioUploaded({ url })),
      Effect.catchTag('UploadPaused', ({ checkpoint }) =>
        Effect.succeed(
          Message.UploadPaused({
            percent:
              checkpoint.totalBytes === 0
                ? 0
                : Math.floor(
                    (checkpoint.completedParts.reduce((bytes, part) => bytes + part.size, 0) /
                      checkpoint.totalBytes) *
                      100,
                  ),
          }),
        ),
      ),
      Effect.catchTag('AlreadyInProgressError', () =>
        Effect.succeed(
          Message.UploadUnavailable({
            message: 'The previous upload is pausing. Select your file again in a moment.',
          }),
        ),
      ),
      Effect.catch((error) => Effect.succeed(Message.UploadFailed({ message: error.message }))),
    ),
})

const PauseUpload = Command.define('Creator.PauseUpload', {
  messages: [Message.UploadPauseAcknowledged],
  execute: Effect.flatMap(CreatorUpload, (service) => service.pause).pipe(
    Effect.as(Message.UploadPauseAcknowledged()),
  ),
})

const CancelUpload = Command.define('Creator.CancelUpload', {
  messages: [Message.UploadCancelled, Message.UploadFailed],
  execute: Effect.flatMap(CreatorUpload, (service) => service.cancel).pipe(
    Effect.as(Message.UploadCancelled()),
    Effect.catch((error) => Effect.succeed(Message.UploadFailed({ message: error.message }))),
  ),
})

const keyOf = (draft: CreatorDraft) => `${draft.kind}:${draft.editSlug ?? 'new'}`

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

export interface InitInput {
  readonly kind: CreatorKind
  readonly editSlug: string | null
  readonly creatorId: string
  readonly authorized: boolean
}

export const initialModel = ({ kind, editSlug, creatorId, authorized }: InitInput): Model => ({
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

export const subscriptions = Subscription.make<Model, Message, CreatorUpload>()(() => ({
  uploadProgress: Subscription.persistent(
    Stream.unwrap(
      CreatorUpload.pipe(
        Effect.map((service) =>
          service.progress.pipe(
            Stream.map((progress) =>
              Message.UploadProgressed({
                percent:
                  progress.totalBytes === 0
                    ? 0
                    : Math.floor((progress.bytesUploaded / progress.totalBytes) * 100),
              }),
            ),
          ),
        ),
      ),
    ),
  ),
}))
