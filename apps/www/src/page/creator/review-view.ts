import * as Button from '@foldkit/ui/button'
import * as Dialog from '@foldkit/ui/dialog'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { imageSource } from '../../view/artwork'
import { richContentView } from '../../view/rich-content/render'
import { Message } from './message'
import { TWEET_MAX_LENGTH, type Model } from './model'

type Builder = HtmlBuilder<typeof Message.Type>

const reviewBody = (model: Model, h: Builder): Html => {
  const current = model.previewContent === model.draft.content

  if (model.previewDocument && current && model.preview === 'ready')
    return h.div(
      [h.Class('creator-review-body')],
      [
        richContentView(model.previewDocument, h, {
          className: 'prose prose-sm dark:prose-invert max-w-none',
        }),
      ],
    )

  if (model.preview === 'failed')
    return h.div(
      [h.Class('creator-inline-alert'), h.Role('alert')],
      [
        h.p([], ['The preview could not load, so embeds are not shown here.']),
        h.button(
          [h.Type('button'), h.Class('btn btn-sm'), h.OnClick(Message.PreviewRequested())],
          ['Try again'],
        ),
      ],
    )

  return h.p([h.Class('creator-preview-status'), h.Role('status')], ['Rendering preview…'])
}

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
                                h.Class('btn btn-quiet btn-icon'),
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
                                model.draft.content.trim() ? reviewBody(model, h) : h.empty,
                                model.draft.musicEntityId
                                  ? h.div(
                                      [h.Class('creator-review-music')],
                                      [
                                        model.musicPreviewImage
                                          ? h.img([imageSource(model.musicPreviewImage), h.Alt('')])
                                          : h.span([h.AriaHidden(true)], ['♫']),
                                        h.span(
                                          [],
                                          [
                                            h.strong(
                                              [],
                                              [
                                                model.musicPreviewTitle ??
                                                  `Attached ${model.draft.musicEntityType ?? 'music'}`,
                                              ],
                                            ),
                                            model.musicPreviewMeta
                                              ? h.small([], [model.musicPreviewMeta])
                                              : h.empty,
                                          ],
                                        ),
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
                              [
                                h.Type('button'),
                                h.Class('btn btn-quiet'),
                                h.OnClick(Message.ReviewClosed()),
                              ],
                              ['Keep editing'],
                            ),
                            Button.view(
                              {
                                onClick: Message.PublishRequested(),
                                isDisabled:
                                  busy ||
                                  !canContinue ||
                                  (model.draft.kind === 'mix' && !model.draft.audioUrl),
                                toView: ({ button }) =>
                                  h.button(
                                    [...button, h.Class('btn btn-primary'), h.AriaBusy(busy)],
                                    [
                                      busy
                                        ? 'Publishing…'
                                        : model.draft.editSlug
                                          ? 'Update'
                                          : 'Publish',
                                    ],
                                  ),
                              },
                              h,
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
