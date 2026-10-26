import * as Dialog from '@foldkit/ui/dialog'
import { mediaReference, SUPPORTED_MEDIA_HINT } from '@gbfm/rich-content/media'
import { Option } from 'effect'
import { Update } from 'foldkit'

import {
  CancelUpload,
  Diagnose,
  PauseUpload,
  PersistDraft,
  RenderPreview,
  ResolveMusic,
  ResolvePostMusic,
  ResolveQuote,
  SearchAuthors,
  Save,
  UploadArtwork,
  UploadAudio,
} from './command'
import { initialModel } from './init'
import { Message } from './message'
import { draftValidationError, keyOf, type Model } from './model'
import type { CreatorDraft, CreatorService } from './services'
import type { CreatorUpload } from './upload/runtime'

/** Renders the current source on the server unless that exact source is already shown or loading. */
const requestPreview = (model: Model): Update.Return<Model, Message, CreatorService> => {
  const content = model.draft.content

  if (!content.trim() || (model.previewContent === content && model.preview !== 'failed'))
    return { model }

  return {
    model: { ...model, preview: 'loading', previewContent: content },
    commands: [RenderPreview({ content })],
  }
}

const changed = (
  model: Model,
  draft: CreatorDraft,
): Update.Return<Model, Message, CreatorService> => {
  const contentChanged = draft.content !== model.draft.content

  const next: Model = {
    ...model,
    draft,
    saveState: 'unsaved',
    error: null,
    diagnostics: contentChanged ? [] : model.diagnostics,
  }

  const preview =
    contentChanged && (model.editorMode === 'preview' || model.phase === 'reviewing')
      ? requestPreview(next)
      : { model: next }

  return {
    model: preview.model,
    commands: [
      PersistDraft({ key: keyOf(draft), draft }),
      ...(contentChanged ? [Diagnose({ content: draft.content })] : []),
      ...(preview.commands ?? []),
    ],
  }
}

/** Accepts only links the renderer can turn into a player, normalised so the directive stays valid. */
const mediaUrl = (value: string): string | null => {
  let url: URL

  try {
    url = new URL(value.trim())
  } catch {
    return null
  }

  if (url.protocol === 'http:') url.protocol = 'https:'

  return url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    mediaReference(url)
    ? url.href
    : null
}

const appendBlock = (content: string, block: string) =>
  content.trim().length === 0 ? block : `${content.replace(/\s+$/, '')}\n\n${block}`

const tweetSlug = (value: string): string | null => {
  const match = /(?:https?:\/\/[^\s/]+)?\/tweet\/([a-z0-9-]+)/i.exec(value.trim())

  return match?.[1] ?? null
}

const reviewDialogFold = {
  read: (model: Model) => Option.some(model.reviewDialog),
  write: (model: Model, reviewDialog: Dialog.Model): Model => ({ ...model, reviewDialog }),
  toParentMessage: (message: Dialog.Message) => Message.GotReviewDialogMessage({ message }),
  foldOutMessage: Dialog.OutMessage.match<Update.Step<Model, Message>>({
    Opened: () => (model) => ({ model: { ...model, phase: 'reviewing' } }),
    Closed: () => (model) => ({
      model: model.phase === 'reviewing' ? { ...model, phase: 'writing' } : model,
    }),
  }),
}

const updateReviewDialog = Update.foldChild({ ...reviewDialogFold, update: Dialog.update })

const openReviewDialog = Update.foldChildStep({ ...reviewDialogFold, update: Dialog.open })

const closeReviewDialog = Update.foldChildStep({ ...reviewDialogFold, update: Dialog.close })

export const update = (
  model: Model,
  message: Message,
): Update.Return<Model, Message, CreatorService | CreatorUpload> =>
  Message.match<Update.Return<Model, Message, CreatorService | CreatorUpload>>(message, {
    Changed: ({ field, value }) => changed(model, { ...model.draft, [field]: value }),
    AuthorQueryChanged: ({ value }) => ({
      model: { ...model, authorQuery: value, authorSearch: 'idle', authorResults: [] },
    }),
    AuthorSearchRequested: () =>
      model.authorQuery.trim() && model.authorized
        ? {
            model: { ...model, authorSearch: 'loading' },
            commands: [SearchAuthors({ query: model.authorQuery.trim() })],
          }
        : { model },
    AuthorsFound: ({ query, creators }) => ({
      model:
        query === model.authorQuery.trim()
          ? { ...model, authorSearch: 'ready', authorResults: creators }
          : model,
    }),
    AuthorSearchFailed: ({ query }) => ({
      model:
        query === model.authorQuery.trim()
          ? { ...model, authorSearch: 'failed', authorResults: [] }
          : model,
    }),
    AuthorSelected: ({ id }) => {
      const creator = model.authorResults.find((creator) => creator.id === id)

      return creator && !model.draft.creatorIds.includes(id)
        ? changed(
            {
              ...model,
              creators: [...model.creators.filter((creator) => creator.id !== id), creator],
            },
            { ...model.draft, creatorIds: [...model.draft.creatorIds, id] },
          )
        : { model }
    },
    AuthorRemoved: ({ id }) =>
      model.draft.creatorIds.length > 1
        ? changed(model, {
            ...model.draft,
            creatorIds: model.draft.creatorIds.filter((creatorId) => creatorId !== id),
          })
        : { model },
    QuoteChanged: ({ value }) =>
      model.draft.editSlug
        ? { model }
        : changed(model, { ...model.draft, quotedPostId: value.trim() || null }),
    QuoteUrlChanged: ({ value }) =>
      model.draft.editSlug
        ? { model }
        : changed(
            { ...model, quotePreview: null },
            { ...model.draft, quoteUrl: value, quotedPostId: null },
          ),
    ResolveQuoteRequested: () => {
      const slug = tweetSlug(model.draft.quoteUrl)

      return slug
        ? { model: { ...model, error: null }, commands: [ResolveQuote({ slug })] }
        : {
            model: {
              ...model,
              error: 'resolve quote: Paste a complete goosebumps.fm tweet URL.',
            },
          }
    },
    QuoteResolved: ({ id, slug, title, content }) =>
      tweetSlug(model.draft.quoteUrl) !== slug
        ? { model }
        : changed(
            { ...model, quotePreview: title ?? content ?? slug },
            { ...model.draft, quotedPostId: id },
          ),
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
      changed(
        {
          ...model,
          musicPreviewTitle: null,
          musicPreviewMeta: null,
          musicPreviewImage: null,
        },
        { ...model.draft, musicUrl: '', musicEntityType: null, musicEntityId: null },
      ),
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
    ReviewRequested: () => Update.combine(model, [openReviewDialog, requestPreview]),
    ReviewClosed: () => closeReviewDialog(model),
    GotReviewDialogMessage: ({ message }) => updateReviewDialog(model, message),
    ResolvePostMusicRequested: () =>
      model.authorized &&
      (model.phase === 'writing' || model.phase === 'published') &&
      !model.resolvingPostMusic &&
      model.draft.kind !== 'mix' &&
      model.draft.postId
        ? {
            model: { ...model, resolvingPostMusic: true, postMusicNotice: null, error: null },
            commands: [ResolvePostMusic({ postId: model.draft.postId, url: model.draft.musicUrl })],
          }
        : { model },
    PostMusicResolved: ({
      postId,
      entityType,
      entityId,
      url,
      title,
      artistNames,
      coverImageUrl,
    }) =>
      model.draft.postId !== postId || !model.resolvingPostMusic
        ? { model }
        : changed(
            {
              ...model,
              resolvingPostMusic: false,
              postMusicNotice: 'Music attachment saved. Other edits are unchanged.',
              musicPreviewTitle: title,
              musicPreviewMeta: [entityType, artistNames.join(', ')].filter(Boolean).join(' · '),
              musicPreviewImage: coverImageUrl,
            },
            { ...model.draft, musicEntityType: entityType, musicEntityId: entityId, musicUrl: url },
          ),
    PostMusicFailed: ({ postId, message }) => ({
      model:
        model.draft.postId === postId
          ? { ...model, resolvingPostMusic: false, error: message }
          : model,
    }),
    ResolveMusicRequested: () =>
      model.resolvingPostMusic
        ? { model }
        : {
            model: { ...model, error: null },
            commands: [ResolveMusic({ url: model.draft.musicUrl.trim(), kind: model.draft.kind })],
          },
    MusicResolved: ({ entityType, entityId, url, title, artistNames, coverImageUrl }) =>
      model.draft.musicUrl.trim() !== url
        ? { model }
        : changed(
            {
              ...model,
              musicPreviewTitle: title,
              musicPreviewMeta: [entityType, artistNames.join(', ')].filter(Boolean).join(' · '),
              musicPreviewImage: coverImageUrl,
            },
            { ...model.draft, musicEntityType: entityType, musicEntityId: entityId },
          ),
    EditorModeChanged: ({ mode }) =>
      mode === 'preview'
        ? requestPreview({ ...model, editorMode: mode })
        : { model: { ...model, editorMode: mode } },
    PreviewRequested: () => requestPreview({ ...model, previewContent: null }),
    PreviewLoaded: ({ content, document }) => ({
      model:
        content === model.previewContent
          ? { ...model, preview: 'ready', previewDocument: document }
          : model,
    }),
    PreviewFailed: ({ content }) => ({
      model: content === model.previewContent ? { ...model, preview: 'failed' } : model,
    }),
    DiagnosticsLoaded: ({ content, diagnostics }) => ({
      model: content === model.draft.content ? { ...model, diagnostics } : model,
    }),
    DiagnosticsFailed: ({ content }) => ({
      model:
        content === model.draft.content
          ? { ...model, error: 'Source diagnostics could not load. Try editing the source again.' }
          : model,
    }),
    FormatInserted: ({ before, after, sample }) =>
      changed(model, {
        ...model.draft,
        content: `${model.draft.content}${before}${sample}${after}`,
      }),
    ExternalMediaChanged: ({ value }) => ({
      model: { ...model, externalMediaUrl: value, externalMediaError: null },
    }),
    ExternalMediaInserted: () => {
      const url = mediaUrl(model.externalMediaUrl)

      return url
        ? changed(
            { ...model, externalMediaUrl: '', externalMediaError: null },
            {
              ...model.draft,
              content: appendBlock(model.draft.content, `::media{url="${url}"}`),
            },
          )
        : {
            model: {
              ...model,
              externalMediaError: `This link has no embeddable player. ${SUPPORTED_MEDIA_HINT}`,
            },
          }
    },
    MusicEmbedInserted: () =>
      model.draft.musicEntityType && model.draft.musicEntityId
        ? changed(model, {
            ...model.draft,
            content: appendBlock(
              model.draft.content,
              `::music{type="${model.draft.musicEntityType}" id="${model.draft.musicEntityId}"}`,
            ),
          })
        : { model },
    DiscardRequested: () => {
      const reset = initialModel({
        kind: model.draft.kind,
        editSlug: model.draft.editSlug,
        creatorId: model.creatorId,
        authorized: model.authorized,
      })

      return {
        model: {
          ...reset,
          phase: 'writing',
          saveState: 'unsaved',
          draft: { ...reset.draft, creatorIds: model.draft.creatorIds },
          creators: model.creators,
        },
      }
    },
    DraftSaveRequested: () =>
      model.resolvingPostMusic ||
      draftValidationError(model.draft) ||
      (model.draft.kind === 'mix' && model.episodeError)
        ? { model }
        : model.authorized
          ? {
              model: { ...model, phase: 'saving' },
              commands: [Save({ draft: model.draft, creatorId: model.creatorId, publish: false })],
            }
          : { model: { ...model, phase: 'forbidden' } },
    PublishRequested: () =>
      model.resolvingPostMusic ||
      draftValidationError(model.draft) ||
      (model.draft.kind === 'mix' && model.episodeError)
        ? { model }
        : model.authorized
          ? Update.combine(model, [
              closeReviewDialog,
              (model) => ({
                model: { ...model, phase: 'saving' },
                commands: [Save({ draft: model.draft, creatorId: model.creatorId, publish: true })],
              }),
            ])
          : { model: { ...model, phase: 'forbidden' } },
    Saved: ({ id, slug, published }) => ({
      model: {
        ...model,
        draft: {
          ...model.draft,
          slug,
          editSlug: slug,
          postId: model.draft.kind === 'mix' ? undefined : id,
        },
        phase: published ? 'published' : 'writing',
        saveState: 'saved',
        error: null,
      },
    }),
    Failed: ({ operation, message }) => ({
      model: { ...model, phase: 'writing', saveState: 'failed', error: `${operation}: ${message}` },
    }),
    Hydrated: ({ draft, creators }) => ({
      model: {
        ...model,
        draft: draft ?? model.draft,
        creators,
        tagsInput: (draft ?? model.draft).tags.join(', '),
        episodeInput: (draft ?? model.draft).episodeNumber?.toString() ?? '',
        phase: 'writing',
        saveState: draft ? 'saved-locally' : model.saveState,
      },
      commands: [Diagnose({ content: (draft ?? model.draft).content })],
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
