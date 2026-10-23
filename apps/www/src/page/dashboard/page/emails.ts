import {
  MAX_MIX_NOTIFICATION_RECIPIENTS,
  MixAnnouncementOptions,
  SendMixNotificationInput,
} from '@gbfm/api/email'
import { Effect, Predicate, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'
import { defineView } from 'foldkit/submodel'

import { DashboardService } from '../service'

export const Model = Schema.Struct({
  options: MixAnnouncementOptions,
  mixSlug: Schema.String,
  audience: Schema.Literals(['all', 'selected']),
  addresses: Schema.String,
  stage: Schema.Literals(['editing', 'checking', 'review', 'sending', 'complete', 'uncertain']),
  recipients: Schema.Array(Schema.String),
  excluded: Schema.Array(Schema.String),
  confirmed: Schema.Boolean,
  error: Schema.NullOr(Schema.String),
  notice: Schema.String,
})

export type Model = typeof Model.Type

export const initialModel: Model = {
  options: { mixes: [], recipients: [] },
  mixSlug: '',
  audience: 'all',
  addresses: '',
  stage: 'editing',
  recipients: [],
  excluded: [],
  confirmed: false,
  error: null,
  notice: '',
}

export const Message = defineMessageUnion({
  MixChanged: { value: Schema.String },
  AudienceChanged: { value: Schema.Literals(['all', 'selected']) },
  AddressesChanged: { value: Schema.String },
  Review: {},
  Reviewed: { options: MixAnnouncementOptions },
  ReviewFailed: {},
  Edit: {},
  Confirmed: { value: Schema.Boolean },
  Send: {},
  Sent: { notice: Schema.String },
  SendFailed: {},
})

export type Message = typeof Message.Type

const Review = Command.define('Emails.Review', {
  messages: [Message.Reviewed, Message.ReviewFailed],
  execute: DashboardService.pipe(
    Effect.flatMap((service) => service.request({ path: '/api/email/mix-announcement-options' })),
    Effect.map((document) =>
      document.announcementOptions
        ? Message.Reviewed({ options: document.announcementOptions })
        : Message.ReviewFailed(),
    ),
    Effect.catch(() => Effect.succeed(Message.ReviewFailed())),
  ),
})

const Send = Command.define('Emails.Send', {
  args: { payload: SendMixNotificationInput },
  messages: [Message.Sent, Message.SendFailed],
  execute: ({ payload }) =>
    DashboardService.pipe(
      Effect.flatMap((service) =>
        service.request({
          path: '/api/email/send-mix-notification',
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      ),
      Effect.map((document) =>
        document.emailSend
          ? Message.Sent({ notice: document.emailSend.message })
          : Message.SendFailed(),
      ),
      Effect.catch(() => Effect.succeed(Message.SendFailed())),
    ),
})

export const update = (
  model: Model,
  message: Message,
): Update.Return<Model, Message, DashboardService> => {
  // No action can replay a completed or ambiguous send. Check history before starting another.
  if (model.stage === 'sending' || model.stage === 'complete' || model.stage === 'uncertain') {
    if (Predicate.isTagged('Sent')(message) && model.stage === 'sending')
      return { model: { ...model, stage: 'complete', notice: message.notice } }

    if (Predicate.isTagged('SendFailed')(message) && model.stage === 'sending')
      return { model: { ...model, stage: 'uncertain' } }

    return { model }
  }

  return Message.match<Update.Return<Model, Message, DashboardService>>(message, {
    MixChanged: ({ value }) => ({
      model: { ...model, mixSlug: value, stage: 'editing', error: null, confirmed: false },
    }),
    AudienceChanged: ({ value }) => ({
      model: { ...model, audience: value, stage: 'editing', error: null, confirmed: false },
    }),
    AddressesChanged: ({ value }) => ({
      model: { ...model, addresses: value, stage: 'editing', error: null, confirmed: false },
    }),
    Review: () =>
      model.stage !== 'editing' || !model.mixSlug
        ? { model }
        : {
            model: { ...model, stage: 'checking', error: null },
            commands: [Review()],
          },
    Reviewed: ({ options }) => {
      if (model.stage !== 'checking') return { model }

      const requested = [
        ...new Set(
          model.addresses
            .split(/[\s,;]+/)
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean),
        ),
      ]

      const eligible = new Set(options.recipients)

      const recipients =
        model.audience === 'all'
          ? options.recipients
          : requested.filter((email) => eligible.has(email))

      const excluded =
        model.audience === 'selected' ? requested.filter((email) => !eligible.has(email)) : []

      const error = !options.mixes.some((mix) => mix.slug === model.mixSlug)
        ? 'This mix is no longer published. Choose another mix.'
        : model.audience === 'selected' && requested.length > MAX_MIX_NOTIFICATION_RECIPIENTS
          ? `Select up to ${MAX_MIX_NOTIFICATION_RECIPIENTS} addresses per send.`
          : recipients.length === 0
            ? 'No eligible recipients. Choose subscribed listeners who allow mix updates.'
            : null

      return {
        model: {
          ...model,
          options,
          recipients,
          excluded,
          confirmed: false,
          error,
          stage: error ? 'editing' : 'review',
        },
      }
    },
    ReviewFailed: () => ({
      model: {
        ...model,
        stage: 'editing',
        error: 'Could not check recipients. Nothing was sent. Try reviewing again.',
      },
    }),
    Edit: () => ({ model: { ...model, stage: 'editing', confirmed: false } }),
    Confirmed: ({ value }) => ({ model: { ...model, confirmed: value } }),
    Send: () =>
      model.stage !== 'review' || !model.confirmed || model.recipients.length === 0
        ? { model }
        : {
            model: { ...model, stage: 'sending', error: null },
            commands: [
              Send({
                payload:
                  model.audience === 'selected'
                    ? { mixSlug: model.mixSlug, recipients: model.recipients }
                    : { mixSlug: model.mixSlug },
              }),
            ],
          },
    Sent: () => ({ model }),
    SendFailed: () => ({ model }),
  })
}

export const view = defineView<Model, Message>((model, h) => {
  const mix = model.options.mixes.find((item) => item.slug === model.mixSlug)
  const terminal = model.stage === 'complete' || model.stage === 'uncertain'
  const reviewing = model.stage === 'review' || model.stage === 'sending'

  return h.div(
    [h.Class('comms-stack')],
    [
      h.p(
        [h.Class('comms-intro')],
        ['A new mix, straight to your listeners. Choose the music, check the audience, then send.'],
      ),
      terminal
        ? h.section(
            [h.Class('dashboard-panel dashboard-form')],
            [
              h.h2(
                [],
                [
                  model.stage === 'complete'
                    ? 'Send finished'
                    : 'Check delivery history before sending again',
                ],
              ),
              h.p(
                [h.Role(model.stage === 'complete' ? 'status' : 'alert')],
                [
                  model.stage === 'complete'
                    ? model.notice
                    : 'We could not confirm the result. Some emails may have been accepted. This screen will not retry the send.',
                ],
              ),
              h.a([h.Href('/dashboard/email-logs')], ['View delivery history →']),
            ],
          )
        : h.div(
            [h.Class('comms-compose')],
            [
              h.section(
                [h.Class('dashboard-panel dashboard-form')],
                [
                  h.h2([], [reviewing ? 'Review announcement' : 'Mix announcement']),
                  h.p(
                    [],
                    [
                      'Uses the existing new-mix email template. Free-form newsletters and saved drafts are not available yet.',
                    ],
                  ),
                  model.error ? h.p([h.Role('alert')], [model.error]) : h.empty,
                  h.fieldset(
                    [h.Disabled(model.stage !== 'editing'), h.Class('comms-fields')],
                    [
                      h.label(
                        [],
                        [
                          'Published mix',
                          h.select(
                            [
                              h.Value(model.mixSlug),
                              h.OnChange((value) => Message.MixChanged({ value })),
                            ],
                            [
                              h.option([h.Value('')], ['Choose a mix']),
                              ...model.options.mixes.map((item) =>
                                h.option([h.Value(item.slug)], [item.title]),
                              ),
                            ],
                          ),
                        ],
                      ),
                      h.label(
                        [],
                        [
                          'Audience',
                          h.select(
                            [
                              h.Value(model.audience),
                              h.OnChange((value) =>
                                Message.AudienceChanged({
                                  value: value === 'selected' ? 'selected' : 'all',
                                }),
                              ),
                            ],
                            [
                              h.option([h.Value('all')], ['All eligible listeners']),
                              h.option([h.Value('selected')], ['Selected email addresses']),
                            ],
                          ),
                        ],
                      ),
                      model.audience === 'selected'
                        ? h.label(
                            [],
                            [
                              `Email addresses (up to ${MAX_MIX_NOTIFICATION_RECIPIENTS})`,
                              h.textarea([
                                h.Rows(5),
                                h.Value(model.addresses),
                                h.OnInput((value) => Message.AddressesChanged({ value })),
                              ]),
                              h.small(
                                [],
                                [
                                  'Separate addresses with commas or new lines. Only eligible listeners will be included.',
                                ],
                              ),
                            ],
                          )
                        : h.p(
                            [],
                            [
                              'Active newsletter subscribers and users who allow mix updates. Addresses are deduplicated.',
                            ],
                          ),
                    ],
                  ),
                  reviewing
                    ? h.div(
                        [h.Class('comms-stack')],
                        [
                          h.label(
                            [h.Class('comms-confirm')],
                            [
                              h.input([
                                h.Type('checkbox'),
                                h.Checked(model.confirmed),
                                h.Disabled(model.stage === 'sending'),
                                h.OnChange(() => Message.Confirmed({ value: !model.confirmed })),
                              ]),
                              `I’m ready to send this announcement to ${model.recipients.length} listener(s).`,
                            ],
                          ),
                          h.div(
                            [h.Class('comms-actions')],
                            [
                              h.button(
                                [h.OnClick(Message.Edit()), h.Disabled(model.stage === 'sending')],
                                ['Back to editing'],
                              ),
                              h.button(
                                [
                                  h.Class('dashboard-button-primary'),
                                  h.Disabled(!model.confirmed || model.stage === 'sending'),
                                  h.OnClick(Message.Send()),
                                ],
                                [model.stage === 'sending' ? 'Sending…' : 'Send announcement'],
                              ),
                            ],
                          ),
                        ],
                      )
                    : h.button(
                        [
                          h.Class('dashboard-button-primary'),
                          h.Disabled(!model.mixSlug || model.stage === 'checking'),
                          h.OnClick(Message.Review()),
                        ],
                        [
                          model.stage === 'checking'
                            ? 'Checking recipients…'
                            : 'Review announcement',
                        ],
                      ),
                ],
              ),
              h.aside(
                [h.Class('dashboard-panel comms-summary')],
                [
                  h.p([h.Class('comms-eyebrow')], [reviewing ? 'Ready to send' : 'At a glance']),
                  h.h2([], [mix ? `New mix: ${mix.title}` : 'Your next announcement']),
                  h.p(
                    [],
                    [
                      mix
                        ? 'The email includes a personal greeting, the mix title, Guide Fari as the artist, and a Listen Now link.'
                        : 'Select a published mix to prepare its announcement.',
                    ],
                  ),
                  mix
                    ? h.a(
                        [
                          h.Href(`/mixes/${encodeURIComponent(mix.slug)}`),
                          h.Target('_blank'),
                          h.Rel('noopener'),
                        ],
                        ['Open mix ↗'],
                      )
                    : h.empty,
                  h.hr([]),
                  h.strong(
                    [],
                    [
                      `${reviewing ? model.recipients.length : model.options.recipients.length} ${reviewing ? 'recipients at review' : 'eligible listeners'}`,
                    ],
                  ),
                  h.p(
                    [],
                    [
                      'Opt-outs are respected and eligibility is checked again when sending. The all-listeners audience may change between review and send.',
                    ],
                  ),
                  reviewing
                    ? h.details(
                        [],
                        [
                          h.summary([], ['Review recipient addresses']),
                          h.ul(
                            [h.Class('comms-addresses')],
                            model.recipients.map((email) => h.li([], [email])),
                          ),
                        ],
                      )
                    : h.empty,
                  model.excluded.length > 0
                    ? h.details(
                        [],
                        [
                          h.summary([], [`${model.excluded.length} address(es) excluded`]),
                          h.p(
                            [],
                            ['Not in the eligible audience; these addresses will not be sent to.'],
                          ),
                          h.ul(
                            [h.Class('comms-addresses')],
                            model.excluded.map((email) => h.li([], [email])),
                          ),
                        ],
                      )
                    : h.empty,
                  h.p(
                    [h.Class('comms-muted')],
                    ['“Sent” means accepted by the email provider, not confirmed inbox delivery.'],
                  ),
                ],
              ),
            ],
          ),
    ],
  )
})
