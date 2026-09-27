import { Effect, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'

import type { CreatorDraft, CreatorError, CreatorKind } from './services'
import { CreatorService } from './services'

const Kind = Schema.Literals(['micro', 'post', 'mix'])

const Draft = Schema.Struct({
  kind: Kind,
  editSlug: Schema.NullOr(Schema.String),
  title: Schema.String,
  slug: Schema.String,
  content: Schema.String,
  description: Schema.String,
  tags: Schema.Array(Schema.String),
  thumbnailUrl: Schema.String,
  musicUrl: Schema.String,
  musicEntityType: Schema.NullOr(Schema.Literals(['album', 'track', 'playlist'])),
  musicEntityId: Schema.NullOr(Schema.String),
  quotedPostId: Schema.NullOr(Schema.String),
  audioUrl: Schema.String,
  showId: Schema.NullOr(Schema.String),
  episodeNumber: Schema.NullOr(Schema.Number),
})

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
  uploadPercent: Schema.Number,
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
  KindChanged: { kind: Kind },
  ReviewRequested: {},
  ReviewClosed: {},
  ResolveMusicRequested: {},
  MusicResolved: {
    entityType: Schema.Literals(['album', 'track', 'playlist']),
    entityId: Schema.String,
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
      Effect.map(({ entityType, entityId }) => Message.MusicResolved({ entityType, entityId })),
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
  args: { file: Schema.instanceOf(File) },
  messages: [Message.AudioUploaded, Message.Failed],
  execute: ({ file }) =>
    Effect.flatMap(CreatorService, (service) => service.uploadMix(file, () => {})).pipe(
      Effect.map((url) => Message.AudioUploaded({ url })),
      Effect.catch((error) => Effect.succeed(failure('audio upload')(error))),
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
): Update.Return<Model, Message, CreatorService> =>
  Message.match<Update.Return<Model, Message, CreatorService>>(message, {
    Changed: ({ field, value }) => changed(model, { ...model.draft, [field]: value }),
    TagsChanged: ({ value }) =>
      changed(model, {
        ...model.draft,
        tags: [
          ...new Set(
            value
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
          ),
        ],
      }),
    KindChanged: ({ kind }) =>
      model.draft.editSlug ? { model } : changed(model, { ...model.draft, kind }),
    ReviewRequested: () => ({ model: { ...model, phase: 'reviewing' } }),
    ReviewClosed: () => ({ model: { ...model, phase: 'writing' } }),
    ResolveMusicRequested: () => ({
      model: { ...model, error: null },
      commands: [ResolveMusic({ url: model.draft.musicUrl.trim(), kind: model.draft.kind })],
    }),
    MusicResolved: ({ entityType, entityId }) =>
      changed(model, { ...model.draft, musicEntityType: entityType, musicEntityId: entityId }),
    DraftSaveRequested: () =>
      model.authorized
        ? {
            model: { ...model, phase: 'saving' },
            commands: [Save({ draft: model.draft, creatorId: model.creatorId, publish: false })],
          }
        : { model: { ...model, phase: 'forbidden' } },
    PublishRequested: () =>
      model.authorized
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
      files[0]
        ? { model: { ...model, phase: 'uploading' }, commands: [UploadAudio({ file: files[0] })] }
        : { model },
    AudioUploaded: ({ url }) =>
      changed(
        { ...model, phase: 'writing', uploadPercent: 100 },
        { ...model.draft, audioUrl: url },
      ),
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
  uploadPercent: 0,
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
