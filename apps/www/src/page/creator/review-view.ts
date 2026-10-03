import * as Dialog from '@foldkit/ui/dialog'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Message } from './message'
import { TWEET_MAX_LENGTH, type Model } from './model'

type Builder = HtmlBuilder<typeof Message.Type>

export const review = (
  model: Model,
  h: Builder,
  busy: boolean,
  canContinue: boolean,
  inputs: { publishType: Html; metadata: Html },
): Html =>
  h.submodel({
    slotId: 'review-dialog',
    model: model.reviewDialog,
    view: Dialog.view,
    viewInputs: {
      toView: ({ dialog, backdrop, panel, title, isVisible }) =>
        h.dialog(
          [...dialog, h.Class('overlay-dialog')],
          isVisible
            ? [
                h.div(
                  [h.Class('creator-review-backdrop')],
                  [
                    h.div([...backdrop, h.Class('overlay-backdrop')]),
                    h.h2([...title, h.Class('sr-only')], ['Publish post']),
                    h.section(
                      [...panel, h.Class('creator-review-shell')],
                      [
                        h.header(
                          [h.Class('creator-review-header')],
                          [
                            h.h2([], [model.draft.editSlug ? 'Update post' : 'Ready to publish']),
                            h.button(
                              [
                                h.Type('button'),
                                h.AriaLabel('Close publish review'),
                                h.OnClick(Message.ReviewClosed()),
                              ],
                              ['×'],
                            ),
                          ],
                        ),
                        inputs.publishType,
                        model.draft.kind === 'micro' && model.draft.title.length > TWEET_MAX_LENGTH
                          ? h.p(
                              [h.Class('form-error')],
                              [
                                `Tweets are capped at ${TWEET_MAX_LENGTH} characters (${model.draft.title.length}). Trim the title or switch to Editorial.`,
                              ],
                            )
                          : h.empty,
                        h.div(
                          [h.Class('creator-review-group')],
                          [
                            h.span([], ['Preview']),
                            h.article(
                              [h.Class('creator-review')],
                              [
                                h.h3([], [model.draft.title || 'Untitled']),
                                model.draft.content
                                  ? h.p([h.Class('creator-review-copy')], [model.draft.content])
                                  : h.empty,
                                model.draft.musicEntityId
                                  ? h.p(
                                      [h.Class('creator-review-music')],
                                      [
                                        `♫ ${model.musicPreviewTitle ?? `Attached ${model.draft.musicEntityType ?? 'music'}`}`,
                                      ],
                                    )
                                  : h.empty,
                                model.quotePreview
                                  ? h.blockquote([], [model.quotePreview])
                                  : h.empty,
                                model.draft.tags.length
                                  ? h.ul(
                                      [h.Class('creator-tag-list'), h.AriaLabel('Tags')],
                                      model.draft.tags.map((tag) => h.li([], [`#${tag}`])),
                                    )
                                  : h.empty,
                              ],
                            ),
                          ],
                        ),
                        inputs.metadata,
                        model.error
                          ? h.p([h.Class('form-error'), h.Role('alert')], [model.error])
                          : h.empty,
                        h.div(
                          [h.Class('creator-publish-actions')],
                          [
                            h.button(
                              [h.Type('button'), h.OnClick(Message.ReviewClosed())],
                              ['Keep editing'],
                            ),
                            h.button(
                              [
                                h.Type('button'),
                                h.OnClick(Message.PublishRequested()),
                                h.Disabled(
                                  busy ||
                                    !canContinue ||
                                    (model.draft.kind === 'mix' && !model.draft.audioUrl),
                                ),
                              ],
                              [busy ? 'Publishing…' : model.draft.editSlug ? 'Update' : 'Publish'],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : [],
        ),
    },
    toParentMessage: (message) => Message.GotReviewDialogMessage({ message }),
  })
