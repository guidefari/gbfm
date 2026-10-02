import { Context, Data, Effect, Layer, Schema } from 'effect'

export type CreatorKind = 'micro' | 'post' | 'mix'

export const CreatorDraftSchema = Schema.Struct({
  kind: Schema.Literals(['micro', 'post', 'mix']),
  editSlug: Schema.NullOr(Schema.String),
  title: Schema.String,
  slug: Schema.String,
  content: Schema.String,
  description: Schema.String,
  tags: Schema.Array(Schema.String),
  creatorIds: Schema.Array(Schema.String),
  thumbnailUrl: Schema.String,
  musicUrl: Schema.String,
  musicEntityType: Schema.NullOr(Schema.Literals(['album', 'track', 'playlist'])),
  musicEntityId: Schema.NullOr(Schema.String),
  quotedPostId: Schema.NullOr(Schema.String),
  quoteUrl: Schema.String,
  audioUrl: Schema.String,
  showId: Schema.NullOr(Schema.String),
  episodeNumber: Schema.NullOr(Schema.Number),
})

export type CreatorDraft = typeof CreatorDraftSchema.Type

export class CreatorRequestError extends Data.TaggedError('CreatorRequestError')<{
  readonly operation: string
  readonly status: number | null
  readonly message: string
}> {}

export class CreatorStorageError extends Data.TaggedError('CreatorStorageError')<{
  readonly operation: 'read' | 'write' | 'clear'
  readonly message: string
}> {}

export class CreatorUploadError extends Data.TaggedError('CreatorUploadError')<{
  readonly stage: 'init' | 'presign' | 'part' | 'complete' | 'image'
  readonly status: number | null
  readonly message: string
}> {}

export type CreatorError = CreatorRequestError | CreatorStorageError | CreatorUploadError

export interface EditableContent extends CreatorDraft {
  readonly draft: boolean
}

export interface SaveInput {
  readonly draft: CreatorDraft
  readonly creatorId: string
  readonly publish: boolean
}

export interface CreatorOperations {
  readonly readLocalDraft: (key: string) => Effect.Effect<CreatorDraft | null, CreatorStorageError>
  readonly writeLocalDraft: (
    key: string,
    draft: CreatorDraft,
  ) => Effect.Effect<void, CreatorStorageError>
  readonly clearLocalDraft: (key: string) => Effect.Effect<void, CreatorStorageError>
  readonly loadEditable: (
    kind: CreatorKind,
    slug: string,
  ) => Effect.Effect<EditableContent, CreatorRequestError>
  readonly resolveMusic: (
    url: string,
    kind: CreatorKind,
  ) => Effect.Effect<
    {
      readonly entityType: 'album' | 'track' | 'playlist'
      readonly entityId: string
      readonly title: string
      readonly artistNames: ReadonlyArray<string>
      readonly coverImageUrl: string | null
    },
    CreatorRequestError
  >
  readonly resolveQuote: (slug: string) => Effect.Effect<
    {
      readonly id: string
      readonly slug: string
      readonly title: string | null
      readonly content: string | null
    },
    CreatorRequestError
  >
  readonly save: (input: SaveInput) => Effect.Effect<{ readonly slug: string }, CreatorRequestError>
  readonly uploadImage: (file: File) => Effect.Effect<string, CreatorUploadError>
}

export class CreatorService extends Context.Service<CreatorService, CreatorOperations>()(
  '@gbfm/www/CreatorService',
) {}

const EditableResponse = Schema.Struct({
  title: Schema.NullOr(Schema.String),
  slug: Schema.String,
  content: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  tags: Schema.NullOr(Schema.Array(Schema.String)),
  thumbnailUrl: Schema.NullOr(Schema.String),
  type: Schema.NullOr(Schema.String),
  musicEntityType: Schema.optional(Schema.NullOr(Schema.String)),
  musicEntityId: Schema.optional(Schema.NullOr(Schema.String)),
  quotedPostId: Schema.optional(Schema.NullOr(Schema.String)),
  url: Schema.optional(Schema.String),
  draft: Schema.optional(Schema.Boolean),
  showId: Schema.optional(Schema.NullOr(Schema.String)),
  episodeNumber: Schema.optional(Schema.NullOr(Schema.Number)),
  creators: Schema.optional(Schema.Array(Schema.Struct({ id: Schema.String }))),
})

const SavedResponse = Schema.Struct({ slug: Schema.String })

const MusicResponse = Schema.Struct({
  entityType: Schema.String,
  entity: Schema.Struct({
    id: Schema.String,
    title: Schema.String,
    artistNames: Schema.optional(Schema.NullOr(Schema.Array(Schema.String))),
  }),
  coverImageUrl: Schema.NullOr(Schema.String),
})

const QuoteResponse = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  title: Schema.NullOr(Schema.String),
  content: Schema.NullOr(Schema.String),
})

const ImageResponse = Schema.Struct({
  uploadUrl: Schema.String,
  publicUrl: Schema.String,
  key: Schema.String,
})

const requestJson = <A>(
  operation: string,
  schema: Schema.Codec<A, unknown, never, unknown>,
  path: string,
  init?: RequestInit,
): Effect.Effect<A, CreatorRequestError> =>
  Effect.tryPromise({
    try: async (signal) => {
      const response = await fetch(`/api${path}`, { credentials: 'include', ...init, signal })

      if (!response.ok) {
        throw new CreatorRequestError({
          operation,
          status: response.status,
          message: 'The content request failed.',
        })
      }

      return response.json()
    },
    catch: (cause) =>
      cause instanceof CreatorRequestError
        ? cause
        : new CreatorRequestError({
            operation,
            status: null,
            message: 'Could not reach the content API.',
          }),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError((cause) =>
      cause instanceof CreatorRequestError
        ? cause
        : new CreatorRequestError({
            operation,
            status: null,
            message: 'The content API returned an invalid response.',
          }),
    ),
  )

type JsonBody = Readonly<Record<string, Schema.Json | undefined>>

const json = (body: JsonBody): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const draftKey = (key: string) => `gbfm:creator:${key}`

export const CreatorServiceLive = Layer.succeed(CreatorService, {
  readLocalDraft: (key) =>
    Effect.try({
      try: () => localStorage.getItem(draftKey(key)),
      catch: () => new CreatorStorageError({ operation: 'read', message: 'Could not read draft.' }),
    }).pipe(
      Effect.flatMap((value) =>
        value === null
          ? Effect.succeed(null)
          : Schema.decodeUnknownEffect(Schema.fromJsonString(CreatorDraftSchema))(value),
      ),
      Effect.mapError(
        () => new CreatorStorageError({ operation: 'read', message: 'Could not restore draft.' }),
      ),
    ),
  writeLocalDraft: (key, draft) =>
    Effect.try({
      try: () => localStorage.setItem(draftKey(key), JSON.stringify(draft)),
      catch: (cause) => new CreatorStorageError({ operation: 'write', message: String(cause) }),
    }),
  clearLocalDraft: (key) =>
    Effect.try({
      try: () => localStorage.removeItem(draftKey(key)),
      catch: (cause) => new CreatorStorageError({ operation: 'clear', message: String(cause) }),
    }),
  loadEditable: (kind, slug) =>
    requestJson(
      'load editable content',
      EditableResponse,
      kind === 'mix'
        ? `/content/audio/mix/${encodeURIComponent(slug)}/edit`
        : `/content/posts/${encodeURIComponent(slug)}/edit`,
    ).pipe(
      Effect.map(
        (item): EditableContent => ({
          kind: kind === 'mix' ? 'mix' : item.type === 'post' ? 'post' : 'micro',
          editSlug: slug,
          title: item.title ?? '',
          slug: item.slug,
          content: item.content ?? '',
          description: item.description ?? '',
          tags: item.tags ?? [],
          thumbnailUrl: item.thumbnailUrl ?? '',
          musicUrl: '',
          musicEntityType:
            item.musicEntityType === 'album' ||
            item.musicEntityType === 'track' ||
            item.musicEntityType === 'playlist'
              ? item.musicEntityType
              : null,
          musicEntityId: item.musicEntityId ?? null,
          quotedPostId: item.quotedPostId ?? null,
          quoteUrl: '',
          audioUrl: item.url ?? '',
          showId: item.showId ?? null,
          episodeNumber: item.episodeNumber ?? null,
          creatorIds: (item.creators ?? []).map(({ id }) => id),
          draft: item.draft ?? false,
        }),
      ),
    ),
  resolveMusic: (url, kind) =>
    requestJson(
      'resolve music',
      MusicResponse,
      '/music/resolve',
      json({ url, origin: kind === 'post' ? 'editorial' : 'tweet' }),
    ).pipe(
      Effect.flatMap(({ entityType, entity, coverImageUrl }) =>
        entityType === 'album' || entityType === 'track' || entityType === 'playlist'
          ? Effect.succeed({
              entityType,
              entityId: entity.id,
              title: entity.title,
              artistNames: entity.artistNames ?? [],
              coverImageUrl,
            })
          : Effect.fail(
              new CreatorRequestError({
                operation: 'resolve music',
                status: 422,
                message: 'Artist links cannot be attached.',
              }),
            ),
      ),
    ),
  resolveQuote: (slug) =>
    requestJson(
      'resolve quoted tweet',
      QuoteResponse,
      `/content/posts/micro/${encodeURIComponent(slug)}`,
    ),
  save: ({ draft, creatorId, publish }) => {
    const slug =
      draft.slug ||
      `${
        draft.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || draft.kind
      }-${Date.now().toString(36)}`

    const payload =
      draft.kind === 'mix'
        ? {
            title: draft.title,
            slug,
            description: draft.description,
            content: draft.content,
            thumbnailUrl: draft.thumbnailUrl,
            url: draft.audioUrl,
            type: 'mix',
            draft: !publish,
            tags: draft.tags,
            idempotencyKey: draft.editSlug ? undefined : crypto.randomUUID(),
            creatorIds: draft.creatorIds.length ? draft.creatorIds : [creatorId],
            showId: draft.showId ?? undefined,
            episodeNumber: draft.episodeNumber ?? undefined,
          }
        : {
            title: draft.title.trim() || null,
            slug,
            description: draft.kind === 'post' ? draft.description : undefined,
            content: draft.content.trim() || null,
            thumbnailUrl: draft.kind === 'post' ? draft.thumbnailUrl : undefined,
            tags: draft.tags,
            draft: !publish,
            type: draft.kind,
            creatorIds: draft.creatorIds.length ? draft.creatorIds : [creatorId],
            musicEntityType: draft.musicEntityType,
            musicEntityId: draft.musicEntityId,
            quotedPostId: draft.editSlug ? undefined : draft.quotedPostId,
          }

    const path = draft.editSlug
      ? draft.kind === 'mix'
        ? `/content/audio/mix/${encodeURIComponent(draft.editSlug)}`
        : `/content/posts/${encodeURIComponent(draft.editSlug)}`
      : draft.kind === 'mix'
        ? '/content/audio'
        : '/content/post'

    return requestJson('save content', SavedResponse, path, {
      ...json(payload),
      method: draft.editSlug ? 'PATCH' : 'POST',
    })
  },
  uploadImage: (file) =>
    Effect.gen(function* () {
      const signed = yield* requestJson(
        'presign image',
        ImageResponse,
        '/upload/image/presign',
        json({ fileName: file.name, contentType: file.type, fileSize: file.size }),
      ).pipe(
        Effect.mapError(
          (error) =>
            new CreatorUploadError({
              stage: 'image',
              status: error.status,
              message: error.message,
            }),
        ),
      )

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(signed.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'content-type': file.type },
          }),
        catch: (cause) =>
          new CreatorUploadError({ stage: 'image', status: null, message: String(cause) }),
      })

      if (!response.ok)
        return yield* new CreatorUploadError({
          stage: 'image',
          status: response.status,
          message: 'Artwork upload failed',
        })

      return signed.publicUrl
    }),
} satisfies CreatorOperations)
