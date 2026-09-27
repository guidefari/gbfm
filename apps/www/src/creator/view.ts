import { canCreatePosts } from '@gbfm/core/roles'
import { Match } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { defineView } from 'foldkit/submodel'

import { richContent } from '../rich-content'
import { Message, type Model } from './model'

export interface ViewInputs {
  readonly role: string | null
}

const field = (
  h: HtmlBuilder<typeof Message.Type>,
  label: string,
  value: string,
  name: 'title' | 'slug' | 'description' | 'musicUrl' | 'thumbnailUrl' | 'audioUrl',
) =>
  h.label(
    [],
    [
      label,
      h.input([h.Value(value), h.OnInput((next) => Message.Changed({ field: name, value: next }))]),
    ],
  )

export const view = defineView<Model, typeof Message.Type, ViewInputs>((model, inputs, h) => {
  if (!model.authorized || !canCreatePosts(inputs.role))
    return h.section(
      [h.Class('page narrow')],
      [h.h1([], ['Creator access required']), h.p([], ['Your account cannot publish content.'])],
    )

  if (model.phase === 'loading')
    return h.section([h.Class('page narrow')], [h.p([], ['Loading draft…'])])

  const busy =
    model.phase === 'saving' || model.phase === 'uploading' || model.uploadState !== 'idle'

  const review = model.phase === 'reviewing'

  const canContinue =
    (model.draft.kind !== 'mix' || !model.episodeError) &&
    (model.draft.title.trim().length > 0 || model.draft.content.trim().length > 0)

  const publishType = h.label(
    [],
    [
      'Publish as',
      h.select(
        [
          h.Value(model.draft.kind),
          h.Disabled(busy || Boolean(model.draft.editSlug)),
          h.OnChange((value) =>
            Message.KindChanged({
              kind: Match.value(value).pipe(
                Match.when('post', () => 'post' as const),
                Match.when('mix', () => 'mix' as const),
                Match.orElse(() => 'micro' as const),
              ),
            }),
          ),
        ],
        [
          h.option([h.Value('micro')], ['Tweet']),
          h.option([h.Value('post')], ['Editorial']),
          h.option([h.Value('mix')], ['Mix']),
        ],
      ),
    ],
  )

  const publicPath = Match.value(model.draft.kind).pipe(
    Match.when('micro', () => 'tweet'),
    Match.when('post', () => 'editorial'),
    Match.when('mix', () => 'mixes'),
    Match.exhaustive,
  )

  return h.section(
    [h.Class('page creator-page')],
    [
      h.header(
        [h.Class('page-heading')],
        [
          h.div(
            [],
            [
              h.p([h.Class('eyebrow')], ['GOOSEBUMPS FM CREATOR']),
              h.h1([], [model.draft.editSlug ? 'Edit content' : 'Create']),
              h.p(
                [],
                [model.saveState === 'saved-locally' ? 'Draft saved locally' : model.saveState],
              ),
            ],
          ),
          h.div(
            [h.Class('creator-actions')],
            [
              h.button(
                [h.OnClick(Message.DraftSaveRequested()), h.Disabled(busy || !canContinue)],
                ['Save draft'],
              ),
              review
                ? h.button([h.OnClick(Message.ReviewClosed())], ['Back to writing'])
                : h.button(
                    [h.OnClick(Message.ReviewRequested()), h.Disabled(busy || !canContinue)],
                    ['Continue'],
                  ),
            ],
          ),
        ],
      ),
      model.error ? h.p([h.Class('form-error'), h.Role('alert')], [model.error]) : h.empty,
      model.draft.kind === 'mix' && model.episodeError
        ? h.p([h.Class('form-error'), h.Role('alert')], [model.episodeError])
        : h.empty,
      model.phase === 'published'
        ? h.p(
            [h.Role('status')],
            [
              'Published. ',
              h.a(
                [h.Href(`/${publicPath}/${encodeURIComponent(model.draft.slug)}`)],
                ['View published content'],
              ),
            ],
          )
        : h.empty,
      review
        ? h.article(
            [h.Class('panel creator-review')],
            [
              h.p([h.Class('eyebrow')], ['PUBLISH REVIEW']),
              publishType,
              model.draft.thumbnailUrl
                ? h.img([h.Src(model.draft.thumbnailUrl), h.Alt('Artwork preview')])
                : h.empty,
              h.h2([], [model.draft.title || 'Untitled']),
              model.draft.description ? h.p([], [model.draft.description]) : h.empty,
              richContent(model.draft.content),
              h.p([], [`Creators: ${model.draft.creatorIds.join(', ')}`]),
              model.draft.quotedPostId ? h.p([], [`Quote: ${model.draft.quotedPostId}`]) : h.empty,
              model.draft.musicEntityId
                ? h.p([], [`Music: ${model.draft.musicEntityType} · ${model.draft.musicEntityId}`])
                : h.empty,
              model.draft.kind === 'mix' && model.draft.showId
                ? h.p(
                    [],
                    [
                      `Show: ${model.draft.showId} · Episode: ${model.draft.episodeNumber ?? 'none'}`,
                    ],
                  )
                : h.empty,
              h.p(
                [],
                [`Type: ${model.draft.kind} · Tags: ${model.draft.tags.join(', ') || 'none'}`],
              ),
              h.button(
                [
                  h.OnClick(Message.PublishRequested()),
                  h.Disabled(
                    busy || !canContinue || (model.draft.kind === 'mix' && !model.draft.audioUrl),
                  ),
                ],
                [busy ? 'Publishing…' : 'Publish'],
              ),
            ],
          )
        : h.div(
            [h.Class('creator-canvas')],
            [
              publishType,
              field(h, 'Title', model.draft.title, 'title'),
              h.label(
                [],
                [
                  'Writing canvas',
                  h.textarea([
                    h.Value(model.draft.content),
                    h.OnInput((value) => Message.Changed({ field: 'content', value })),
                    h.Rows(14),
                    h.Placeholder('Start writing…'),
                  ]),
                ],
              ),
              field(h, 'Description', model.draft.description, 'description'),
              h.label(
                [],
                [
                  'Tags',
                  h.input([
                    h.Value(model.tagsInput),
                    h.OnInput((value) => Message.TagsChanged({ value })),
                    h.Placeholder('house, johannesburg'),
                  ]),
                ],
              ),
              field(h, 'Slug', model.draft.slug, 'slug'),
              h.label(
                [],
                [
                  'Creator IDs (comma separated)',
                  h.input([
                    h.Value(model.creatorsInput),
                    h.Disabled(busy),
                    h.OnInput((value) => Message.CreatorsChanged({ value })),
                  ]),
                ],
              ),
              model.draft.kind !== 'mix'
                ? h.label(
                    [],
                    [
                      'Quoted post ID',
                      h.input([
                        h.Value(model.draft.quotedPostId ?? ''),
                        h.Disabled(busy || Boolean(model.draft.editSlug)),
                        h.OnInput((value) => Message.QuoteChanged({ value })),
                      ]),
                    ],
                  )
                : h.empty,
              model.draft.kind !== 'mix'
                ? h.div(
                    [h.Class('creator-inline')],
                    [
                      field(h, 'Music URL', model.draft.musicUrl, 'musicUrl'),
                      h.button(
                        [
                          h.OnClick(Message.ResolveMusicRequested()),
                          h.Disabled(!model.draft.musicUrl.trim()),
                        ],
                        ['Attach music'],
                      ),
                      model.draft.musicEntityId
                        ? h.div(
                            [],
                            [
                              h.small([], [`Attached ${model.draft.musicEntityType}`]),
                              h.button(
                                [h.Disabled(busy), h.OnClick(Message.MusicRemoved())],
                                ['Remove music'],
                              ),
                            ],
                          )
                        : h.empty,
                    ],
                  )
                : h.empty,
              model.draft.kind !== 'micro'
                ? h.div(
                    [h.Class('creator-media')],
                    [
                      field(h, 'Artwork URL', model.draft.thumbnailUrl, 'thumbnailUrl'),
                      h.label(
                        [],
                        [
                          'Upload artwork',
                          h.input([
                            h.Type('file'),
                            h.Accept('image/*'),
                            h.Disabled(busy),
                            h.OnFileChange((files) => Message.ArtworkChosen({ files: [...files] })),
                          ]),
                        ],
                      ),
                    ],
                  )
                : h.empty,
              model.draft.kind === 'mix'
                ? h.div(
                    [h.Class('creator-media')],
                    [
                      field(h, 'Existing audio URL', model.draft.audioUrl, 'audioUrl'),
                      h.label(
                        [],
                        [
                          'Show ID',
                          h.input([
                            h.Value(model.draft.showId ?? ''),
                            h.Disabled(busy),
                            h.OnInput((value) => Message.ShowChanged({ value })),
                          ]),
                        ],
                      ),
                      h.label(
                        [],
                        [
                          'Episode number',
                          h.input([
                            h.Type('number'),
                            h.Min('1'),
                            h.Step('1'),
                            h.Value(model.episodeInput),
                            h.Disabled(busy),
                            h.OnInput((value) => Message.EpisodeChanged({ value })),
                          ]),
                        ],
                      ),
                      h.label(
                        [],
                        [
                          'Mix audio (multipart upload)',
                          h.input([
                            h.Type('file'),
                            h.Accept('audio/*'),
                            h.Disabled(busy),
                            h.OnFileChange((files) => Message.AudioChosen({ files: [...files] })),
                          ]),
                        ],
                      ),
                      h.small(
                        [],
                        [
                          'After a reload, select the same file to resume from the last completed part.',
                        ],
                      ),
                      model.uploadState !== 'idle'
                        ? h.div(
                            [h.Class('panel upload-progress')],
                            [
                              h.p(
                                [h.Role('status')],
                                [
                                  `${model.uploadState === 'pausing' ? 'Pausing after the current part' : model.uploadState === 'paused' ? 'Upload paused' : model.uploadState === 'failed' ? 'Upload interrupted' : model.uploadState === 'cancelling' ? 'Cancelling upload' : model.uploadPercent === 100 ? 'Finalizing upload' : 'Uploading audio'} · ${model.uploadPercent}%`,
                                ],
                              ),
                              h.progress(
                                [
                                  h.Value(String(model.uploadPercent)),
                                  h.Max('100'),
                                  h.AriaLabel('Audio upload progress'),
                                ],
                                [],
                              ),
                              model.uploadState === 'running'
                                ? h.button(
                                    [h.OnClick(Message.UploadPauseRequested())],
                                    ['Pause upload'],
                                  )
                                : h.empty,
                              model.uploadState === 'paused' || model.uploadState === 'failed'
                                ? h.div(
                                    [h.Class('creator-actions')],
                                    [
                                      h.button(
                                        [h.OnClick(Message.UploadResumeRequested())],
                                        ['Resume upload'],
                                      ),
                                      h.button(
                                        [h.OnClick(Message.UploadCancelRequested())],
                                        ['Cancel upload'],
                                      ),
                                    ],
                                  )
                                : h.empty,
                            ],
                          )
                        : h.empty,
                      model.draft.audioUrl ? h.small([], ['Audio ready']) : h.empty,
                    ],
                  )
                : h.empty,
            ],
          ),
    ],
  )
})
