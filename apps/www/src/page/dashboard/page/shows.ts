import { CreateShowInput, GetAllShowsResponse } from '@gbfm/api/shows'
import { Effect, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'
import { defineView } from 'foldkit/submodel'

import { DashboardService } from '../service'

const fields = [
  'title',
  'slug',
  'description',
  'content',
  'thumbnailUrl',
  'bannerImageUrl',
  'tags',
] as const

const Field = Schema.Literals(fields)

const Form = Schema.Struct({
  title: Schema.String,
  slug: Schema.String,
  description: Schema.String,
  content: Schema.String,
  thumbnailUrl: Schema.String,
  bannerImageUrl: Schema.String,
  tags: Schema.String,
})

const emptyForm = {
  title: '',
  slug: '',
  description: '',
  content: '',
  thumbnailUrl: '',
  bannerImageUrl: '',
  tags: '',
}

export const Model = Schema.Struct({
  listing: Schema.optional(GetAllShowsResponse),
  form: Form,
  draft: Schema.Boolean,
  editing: Schema.NullOr(Schema.String),
  deleting: Schema.NullOr(Schema.String),
  busy: Schema.Boolean,
  error: Schema.NullOr(Schema.String),
  notice: Schema.String,
})

export type Model = typeof Model.Type

export const initialModel: Model = {
  form: emptyForm,
  draft: true,
  editing: null,
  deleting: null,
  busy: false,
  error: null,
  notice: '',
}

export const Message = defineMessageUnion({
  FieldChanged: { field: Field, value: Schema.String },
  DraftChanged: {},
  Edit: { slug: Schema.String },
  Clear: {},
  Save: {},
  AskDelete: { slug: Schema.String },
  CancelDelete: {},
  ConfirmDelete: {},
  Load: { offset: Schema.Number },
  Loaded: { listing: GetAllShowsResponse },
  Saved: {},
  Failed: { message: Schema.String },
})

export type Message = typeof Message.Type

const Load = Command.define('Shows.Load', {
  args: { offset: Schema.Number },
  messages: [Message.Loaded, Message.Failed],
  execute: ({ offset }) =>
    DashboardService.pipe(
      Effect.flatMap((service) =>
        service.request({ path: `/api/shows/manage?limit=25&offset=${offset}` }),
      ),
      Effect.map((document) =>
        document.shows
          ? Message.Loaded({ listing: document.shows })
          : Message.Failed({ message: 'Invalid shows response.' }),
      ),
      Effect.catch((error) => Effect.succeed(Message.Failed({ message: error.message }))),
    ),
})

const Save = Command.define('Shows.Save', {
  args: { form: Form, draft: Schema.Boolean, editing: Schema.NullOr(Schema.String) },
  messages: [Message.Saved, Message.Failed],
  execute: ({ form, draft, editing }) =>
    Effect.gen(function* () {
      const payload = yield* Schema.decodeUnknownEffect(CreateShowInput)({
        ...form,
        title: form.title.trim(),
        slug: form.slug.trim(),
        draft,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })

      const service = yield* DashboardService
      yield* service.request({
        path: editing ? `/api/shows/${encodeURIComponent(editing)}` : '/api/shows',
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })

      return Message.Saved()
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(
          Message.Failed({
            message:
              'Could not save the show. Check required fields, slug availability and your access.',
          }),
        ),
      ),
    ),
})

const Delete = Command.define('Shows.Delete', {
  args: { slug: Schema.String },
  messages: [Message.Saved, Message.Failed],
  execute: ({ slug }) =>
    DashboardService.pipe(
      Effect.flatMap((service) =>
        service.request({ path: `/api/shows/${encodeURIComponent(slug)}`, method: 'DELETE' }),
      ),
      Effect.as(Message.Saved()),
      Effect.catch((error) => Effect.succeed(Message.Failed({ message: error.message }))),
    ),
})

export const update = (
  model: Model,
  message: Message,
): Update.Return<Model, Message, DashboardService> =>
  Message.match<Update.Return<Model, Message, DashboardService>>(message, {
    FieldChanged: ({ field, value }) =>
      model.busy ? { model } : { model: { ...model, form: { ...model.form, [field]: value } } },
    DraftChanged: () => (model.busy ? { model } : { model: { ...model, draft: !model.draft } }),
    Edit: ({ slug }) => {
      const show = model.listing?.data.find((show) => show.slug === slug)

      if (!show || model.busy) return { model }

      return {
        model: {
          ...model,
          editing: slug,
          deleting: null,
          error: null,
          notice: '',
          draft: show.draft,
          form: {
            title: show.title,
            slug: show.slug,
            description: show.description ?? '',
            content: show.content,
            thumbnailUrl: show.thumbnailUrl ?? '',
            bannerImageUrl: show.bannerImageUrl ?? '',
            tags: show.tags?.join(', ') ?? '',
          },
        },
      }
    },
    Clear: () => (model.busy ? { model } : { model: { ...initialModel, listing: model.listing } }),
    Save: () =>
      model.busy
        ? { model }
        : {
            model: { ...model, busy: true, error: null },
            commands: [Save({ form: model.form, draft: model.draft, editing: model.editing })],
          },
    AskDelete: ({ slug }) =>
      model.busy || !model.listing?.data.some((show) => show.slug === slug)
        ? { model }
        : { model: { ...model, deleting: slug } },
    CancelDelete: () => (model.busy ? { model } : { model: { ...model, deleting: null } }),
    ConfirmDelete: () =>
      model.busy || !model.deleting
        ? { model }
        : {
            model: { ...model, busy: true, error: null },
            commands: [Delete({ slug: model.deleting })],
          },
    Load: ({ offset }) =>
      model.busy
        ? { model }
        : { model: { ...model, busy: true, error: null }, commands: [Load({ offset })] },
    Loaded: ({ listing }) => ({ model: { ...model, listing, busy: false, error: null } }),
    Saved: () => ({
      model: { ...initialModel, listing: model.listing, busy: true, notice: 'Show changes saved.' },
      commands: [Load({ offset: 0 })],
    }),
    Failed: ({ message }) => ({ model: { ...model, busy: false, error: message } }),
  })

const labels = {
  title: 'Title',
  slug: 'Slug',
  description: 'Description',
  content: 'Content',
  thumbnailUrl: 'Thumbnail URL',
  bannerImageUrl: 'Banner URL',
  tags: 'Tags (comma separated)',
}

export const view = defineView<Model, Message>((model, h) =>
  h.section(
    [h.Class('dashboard-form')],
    [
      model.error ? h.p([h.Role('alert')], [model.error]) : h.empty,
      model.notice ? h.p([h.Role('status')], [model.notice]) : h.empty,
      h.form(
        [h.Class('dashboard-panel dashboard-form'), h.OnSubmit(Message.Save())],
        [
          h.h2([], [model.editing ? 'Edit show' : 'Create show']),
          ...fields.map((field) =>
            h.label(
              [],
              [
                labels[field],
                field === 'content' || field === 'description'
                  ? h.textarea([
                      h.Value(model.form[field]),
                      h.Disabled(model.busy),
                      h.Rows(field === 'content' ? 6 : 3),
                      h.OnInput((value) => Message.FieldChanged({ field, value })),
                    ])
                  : h.input([
                      h.Value(model.form[field]),
                      h.Disabled(model.busy),
                      h.Required(field === 'title' || field === 'slug'),
                      h.OnInput((value) => Message.FieldChanged({ field, value })),
                    ]),
              ],
            ),
          ),
          h.label(
            [h.Class('dashboard-toggle')],
            [
              'Draft',
              h.input([
                h.Type('checkbox'),
                h.Checked(model.draft),
                h.Disabled(model.busy),
                h.OnClick(Message.DraftChanged()),
              ]),
            ],
          ),
          h.div(
            [h.Class('creator-actions')],
            [
              h.button(
                [h.Type('submit'), h.Disabled(model.busy)],
                [model.busy ? 'Saving…' : model.editing ? 'Save changes' : 'Create show'],
              ),
              model.editing
                ? h.button(
                    [h.Type('button'), h.Disabled(model.busy), h.OnClick(Message.Clear())],
                    ['Cancel editing'],
                  )
                : h.empty,
            ],
          ),
        ],
      ),
      h.ul(
        [h.Class('dashboard-list session-list')],
        (model.listing?.data ?? []).map((show) =>
          h.li(
            [h.Key(show.id)],
            [
              h.div(
                [],
                [
                  h.strong([], [show.title]),
                  h.small([], [`${show.slug} · ${show.draft ? 'Draft' : 'Published'}`]),
                ],
              ),
              h.div(
                [h.Class('creator-actions')],
                [
                  h.button(
                    [h.Disabled(model.busy), h.OnClick(Message.Edit({ slug: show.slug }))],
                    ['Edit'],
                  ),
                  h.button(
                    [h.Disabled(model.busy), h.OnClick(Message.AskDelete({ slug: show.slug }))],
                    ['Delete'],
                  ),
                  !show.draft
                    ? h.a([h.Href(`/shows/${encodeURIComponent(show.slug)}`)], ['View show'])
                    : h.empty,
                ],
              ),
            ],
          ),
        ),
      ),
      model.deleting
        ? h.section(
            [h.Class('dashboard-panel'), h.Role('alert')],
            [
              h.p([], [`Permanently delete ${model.deleting}? This cannot be undone.`]),
              h.button(
                [h.Disabled(model.busy), h.OnClick(Message.ConfirmDelete())],
                ['Confirm delete'],
              ),
              h.button([h.Disabled(model.busy), h.OnClick(Message.CancelDelete())], ['Keep show']),
            ],
          )
        : h.empty,
      model.listing
        ? h.nav(
            [h.AriaLabel('Show pages'), h.Class('user-pagination')],
            [
              h.button(
                [
                  h.Disabled(model.busy || model.listing.pagination.offset === 0),
                  h.OnClick(
                    Message.Load({ offset: Math.max(0, model.listing.pagination.offset - 25) }),
                  ),
                ],
                ['Previous shows'],
              ),
              h.span([], [`${model.listing.pagination.total} shows`]),
              h.button(
                [
                  h.Disabled(model.busy || !model.listing.pagination.hasMore),
                  h.OnClick(Message.Load({ offset: model.listing.pagination.offset + 25 })),
                ],
                ['Next shows'],
              ),
            ],
          )
        : h.empty,
    ],
  ),
)
