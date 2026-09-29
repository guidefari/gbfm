import { Effect, Schema } from 'effect'
import { Command } from 'foldkit'

import { Message } from './message'
import { keyOf, Kind } from './model'
import type { CreatorDraft, CreatorError } from './services'
import { CreatorDraftSchema as Draft, CreatorService } from './services'
import { CreatorUpload } from './upload/runtime'

const failure = (operation: string) => (error: CreatorError) =>
  Message.Failed({ operation, message: error.message })

export const PersistDraft = Command.define('Creator.PersistDraft', {
  args: { key: Schema.String, draft: Draft },
  messages: [Message.LocallySaved, Message.Failed],
  execute: ({ key, draft }) =>
    Effect.flatMap(CreatorService, (service) => service.writeLocalDraft(key, draft)).pipe(
      Effect.as(Message.LocallySaved()),
      Effect.catch((error) => Effect.succeed(failure('autosave')(error))),
    ),
})

export const Hydrate = Command.define('Creator.Hydrate', {
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

export const ResolveMusic = Command.define('Creator.ResolveMusic', {
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

export const Save = Command.define('Creator.Save', {
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

export const UploadArtwork = Command.define('Creator.UploadArtwork', {
  args: { file: Schema.instanceOf(File) },
  messages: [Message.ArtworkUploaded, Message.Failed],
  execute: ({ file }) =>
    Effect.flatMap(CreatorService, (service) => service.uploadImage(file)).pipe(
      Effect.map((url) => Message.ArtworkUploaded({ url })),
      Effect.catch((error) => Effect.succeed(failure('artwork upload')(error))),
    ),
})

export const UploadAudio = Command.define('Creator.UploadAudio', {
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

export const PauseUpload = Command.define('Creator.PauseUpload', {
  messages: [Message.UploadPauseAcknowledged],
  execute: Effect.flatMap(CreatorUpload, (service) => service.pause).pipe(
    Effect.as(Message.UploadPauseAcknowledged()),
  ),
})

export const CancelUpload = Command.define('Creator.CancelUpload', {
  messages: [Message.UploadCancelled, Message.UploadFailed],
  execute: Effect.flatMap(CreatorUpload, (service) => service.cancel).pipe(
    Effect.as(Message.UploadCancelled()),
    Effect.catch((error) => Effect.succeed(Message.UploadFailed({ message: error.message }))),
  ),
})
