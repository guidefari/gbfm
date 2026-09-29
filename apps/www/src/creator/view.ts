import { canCreatePosts } from '@gbfm/core/roles'
import { parseRichContent } from '@gbfm/rich-content/source'
import { Match } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineView } from 'foldkit/submodel'

import { richContent } from '../rich-content'
import { draftValidationError, Message, TWEET_MAX_LENGTH, type Model } from './model'

export interface ViewInputs {
  readonly role: string | null
}

type Builder = HtmlBuilder<typeof Message.Type>

const field = (
  h: Builder,
  label: string,
  value: string,
  name: 'title' | 'slug' | 'description' | 'musicUrl' | 'thumbnailUrl' | 'audioUrl',
  placeholder = '',
) =>
  h.label(
    [],
    [
      label,
      h.input([
        h.Value(value),
        h.Placeholder(placeholder),
        h.OnInput((next) => Message.Changed({ field: name, value: next })),
      ]),
    ],
  )

const publishType = (model: Model, h: Builder, busy: boolean) =>
  h.label(
    [h.Class('creator-type')],
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

const editor = (model: Model, h: Builder): Html => {
  const diagnostics = parseRichContent(model.draft.content).diagnostics

  const controls = [
    ['Heading', '## ', '', 'Heading'],
    ['Bold', '**', '**', 'bold text'],
    ['Italic', '_', '_', 'italic text'],
    ['Link', '[', '](https://)', 'link text'],
    ['Quote', '> ', '', 'Quoted text'],
    ['List', '- ', '', 'List item'],
  ] as const

  return h.section(
    [h.Class('creator-editor'), h.AriaLabel('Rich text editor')],
    [
      h.div(
        [h.Class('creator-editor-bar')],
        [
          h.div(
            [h.Class('creator-editor-tools'), h.AriaLabel('Formatting controls')],
            controls.map(([label, before, after, sample]) =>
              h.button(
                [
                  h.Type('button'),
                  h.Title(label),
                  h.AriaLabel(label),
                  h.OnClick(Message.FormatInserted({ before, after, sample })),
                ],
                [label],
              ),
            ),
          ),
          h.div(
            [h.Class('creator-editor-modes'), h.AriaLabel('Editor view')],
            [
              h.button(
                [
                  h.Type('button'),
                  h.AriaPressed(String(model.editorMode === 'source')),
                  h.OnClick(Message.EditorModeChanged({ mode: 'source' })),
                ],
                ['Source'],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.AriaPressed(String(model.editorMode === 'preview')),
                  h.OnClick(Message.EditorModeChanged({ mode: 'preview' })),
                ],
                ['Preview'],
              ),
            ],
          ),
        ],
      ),
      model.editorMode === 'source'
        ? h.label(
            [h.Class('creator-source')],
            [
              h.span([h.Class('sr-only')], ['Writing canvas']),
              h.textarea([
                h.Value(model.draft.content),
                h.OnInput((value) => Message.Changed({ field: 'content', value })),
                h.Rows(18),
                h.Placeholder('Start writing…'),
              ]),
            ],
          )
        : h.div(
            [h.Class('creator-preview')],
            [
              model.draft.content.trim()
                ? richContent(model.draft.content)
                : h.p([h.Class('creator-empty')], ['Your rendered post will appear here.']),
            ],
          ),
      diagnostics.length
        ? h.ul(
            [h.Class('creator-diagnostics'), h.AriaLabel('Source diagnostics')],
            diagnostics.map((item) =>
              h.li([], [`${item.line ? `Line ${item.line}: ` : ''}${item.message}`]),
            ),
          )
        : h.empty,
    ],
  )
}

const musicSlot = (model: Model, h: Builder, busy: boolean): Html =>
  model.draft.musicEntityId
    ? h.article(
        [h.Class('creator-music-card')],
        [
          model.musicPreviewImage
            ? h.img([h.Src(model.musicPreviewImage), h.Alt('Music cover art')])
            : h.div([h.Class('creator-music-placeholder'), h.AriaHidden(true)], ['♫']),
          h.div(
            [h.Class('creator-music-copy')],
            [
              h.strong([], [model.musicPreviewTitle ?? 'Attached music']),
              h.small([], [model.musicPreviewMeta ?? model.draft.musicEntityType ?? 'music']),
              h.small([], [model.draft.musicUrl]),
            ],
          ),
          h.div(
            [h.Class('creator-music-actions')],
            [
              h.button(
                [h.Type('button'), h.OnClick(Message.MusicEmbedInserted())],
                ['Insert in story'],
              ),
              h.button(
                [h.Type('button'), h.Disabled(busy), h.OnClick(Message.MusicRemoved())],
                ['Remove'],
              ),
            ],
          ),
        ],
      )
    : h.div(
        [h.Class('creator-attach-row')],
        [
          h.label(
            [],
            [
              h.span([h.Class('sr-only')], ['Music URL']),
              h.input([
                h.Value(model.draft.musicUrl),
                h.OnInput((value) => Message.Changed({ field: 'musicUrl', value })),
                h.Placeholder('Paste a Spotify, Apple Music or Bandcamp link'),
              ]),
            ],
          ),
          h.button(
            [
              h.Type('button'),
              h.OnClick(Message.ResolveMusicRequested()),
              h.Disabled(!model.draft.musicUrl.trim()),
            ],
            ['Attach music'],
          ),
        ],
      )

const metadata = (model: Model, h: Builder, busy: boolean): Html =>
  h.aside(
    [h.Class('creator-metadata'), h.AriaLabel('Post details')],
    [
      h.h2([], ['Post details']),
      field(h, 'Story URL', model.draft.slug, 'slug', 'generated-from-title'),
      model.draft.kind === 'post'
        ? field(h, 'Description', model.draft.description, 'description', 'A short introduction')
        : h.empty,
      h.label(
        [],
        [
          'Tags',
          h.input([
            h.Value(model.tagsInput),
            h.AriaLabel('Tags'),
            h.OnInput((value) => Message.TagsChanged({ value })),
            h.Placeholder('house, johannesburg'),
          ]),
          h.small([], ['Separate tags with commas.']),
        ],
      ),
      h.label(
        [],
        [
          'Authors',
          h.input([
            h.Value(model.creatorsInput),
            h.AriaLabel('Authors'),
            h.Disabled(busy),
            h.OnInput((value) => Message.CreatorsChanged({ value })),
          ]),
          h.small([], ['Comma-separated creator IDs.']),
        ],
      ),
      model.draft.kind === 'post'
        ? h.div(
            [h.Class('creator-artwork')],
            [
              model.draft.thumbnailUrl
                ? h.img([h.Src(model.draft.thumbnailUrl), h.Alt('Editorial artwork preview')])
                : h.empty,
              field(h, 'Artwork URL', model.draft.thumbnailUrl, 'thumbnailUrl', 'https://…'),
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
      model.draft.kind !== 'mix' && !model.draft.editSlug
        ? h.div(
            [h.Class('creator-quote')],
            [
              h.label(
                [],
                [
                  'Quote a tweet',
                  h.input([
                    h.Value(model.draft.quoteUrl),
                    h.OnInput((value) => Message.QuoteUrlChanged({ value })),
                    h.Placeholder('https://goosebumps.fm/tweet/…'),
                  ]),
                ],
              ),
              h.button(
                [h.Type('button'), h.OnClick(Message.ResolveQuoteRequested())],
                ['Attach quote'],
              ),
              model.quotePreview
                ? h.blockquote([], [h.small([], ['Quoted tweet']), h.p([], [model.quotePreview])])
                : h.empty,
            ],
          )
        : h.empty,
      h.div(
        [h.Class('creator-media-insert')],
        [
          h.label(
            [],
            [
              'External media',
              h.input([
                h.Value(model.externalMediaUrl),
                h.OnInput((value) => Message.ExternalMediaChanged({ value })),
                h.Placeholder('YouTube, SoundCloud, Bandcamp or Spotify URL'),
              ]),
            ],
          ),
          h.button(
            [
              h.Type('button'),
              h.Disabled(!model.externalMediaUrl.trim()),
              h.OnClick(Message.ExternalMediaInserted()),
            ],
            ['Insert media'],
          ),
        ],
      ),
    ],
  )

const mixFields = (model: Model, h: Builder, busy: boolean): Html =>
  h.div(
    [h.Class('creator-mix-fields')],
    [
      field(h, 'Existing audio URL', model.draft.audioUrl, 'audioUrl'),
      h.label(
        [],
        [
          'Show ID',
          h.input([
            h.Value(model.draft.showId ?? ''),
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
            h.OnInput((value) => Message.EpisodeChanged({ value })),
          ]),
        ],
      ),
      h.label(
        [],
        [
          'Mix audio',
          h.input([
            h.Type('file'),
            h.Accept('audio/*'),
            h.Disabled(busy),
            h.OnFileChange((files) => Message.AudioChosen({ files: [...files] })),
          ]),
        ],
      ),
      model.uploadState !== 'idle'
        ? h.div(
            [h.Class('upload-progress')],
            [
              h.p([h.Role('status')], [`${model.uploadState} · ${model.uploadPercent}%`]),
              h.progress(
                [
                  h.Value(String(model.uploadPercent)),
                  h.Max('100'),
                  h.AriaLabel('Audio upload progress'),
                ],
                [],
              ),
            ],
          )
        : h.empty,
    ],
  )

const review = (model: Model, h: Builder, busy: boolean, canContinue: boolean): Html =>
  h.div(
    [h.Class('creator-review-shell')],
    [
      h.article(
        [h.Class('creator-review')],
        [
          h.p([h.Class('eyebrow')], ['PREVIEW']),
          model.draft.kind === 'post' && model.draft.thumbnailUrl
            ? h.img([h.Src(model.draft.thumbnailUrl), h.Alt('Artwork preview')])
            : h.empty,
          h.h2([], [model.draft.title || 'Untitled']),
          model.draft.kind === 'post' && model.draft.description
            ? h.p([h.Class('creator-deck')], [model.draft.description])
            : h.empty,
          richContent(model.draft.content),
          model.draft.musicEntityId
            ? h.p(
                [h.Class('creator-review-music')],
                [
                  `♫ ${model.musicPreviewTitle ?? `Attached ${model.draft.musicEntityType ?? 'music'}`}`,
                ],
              )
            : h.empty,
          model.quotePreview ? h.blockquote([], [model.quotePreview]) : h.empty,
          model.draft.tags.length
            ? h.ul(
                [h.Class('creator-tag-list'), h.AriaLabel('Tags')],
                model.draft.tags.map((tag) => h.li([], [`#${tag}`])),
              )
            : h.empty,
        ],
      ),
      h.aside(
        [h.Class('creator-publish-panel')],
        [
          h.p([h.Class('eyebrow')], ['READY TO PUBLISH']),
          h.h2([], [model.draft.editSlug ? 'Update post' : 'Final checks']),
          publishType(model, h, busy),
          h.dl(
            [],
            [
              h.dt([], ['Authors']),
              h.dd([], [String(model.draft.creatorIds.length)]),
              h.dt([], ['Tags']),
              h.dd([], [String(model.draft.tags.length)]),
              h.dt([], ['Status']),
              h.dd([], [model.draft.editSlug ? 'Existing post' : 'New post']),
            ],
          ),
          h.div(
            [h.Class('creator-publish-actions')],
            [
              h.button([h.Type('button'), h.OnClick(Message.ReviewClosed())], ['Keep editing']),
              h.button(
                [
                  h.Type('button'),
                  h.OnClick(Message.PublishRequested()),
                  h.Disabled(
                    busy || !canContinue || (model.draft.kind === 'mix' && !model.draft.audioUrl),
                  ),
                ],
                [busy ? 'Publishing…' : model.draft.editSlug ? 'Update' : 'Publish'],
              ),
            ],
          ),
        ],
      ),
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

  const validationError = draftValidationError(model.draft)
  const canContinue = !validationError && !model.episodeError

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
        [h.Class('creator-header')],
        [
          h.div(
            [h.Class('creator-status')],
            [
              model.draft.editSlug
                ? h.a([h.Href(`/${publicPath}/${model.draft.editSlug}`)], ['Back to post'])
                : h.empty,
              h.span(
                [h.Role('status'), h.AriaLive('polite')],
                [model.saveState === 'saved-locally' ? 'Draft saved locally' : model.saveState],
              ),
            ],
          ),
          h.div(
            [h.Class('creator-actions')],
            [
              h.button(
                [h.Type('button'), h.OnClick(Message.DiscardRequested()), h.Disabled(busy)],
                ['Discard'],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.OnClick(Message.DraftSaveRequested()),
                  h.Disabled(busy || !canContinue),
                ],
                ['Save draft'],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.OnClick(Message.ReviewRequested()),
                  h.Disabled(busy || !canContinue),
                ],
                ['Continue'],
              ),
            ],
          ),
        ],
      ),
      model.error ? h.p([h.Class('form-error'), h.Role('alert')], [model.error]) : h.empty,
      model.episodeError
        ? h.p([h.Class('form-error'), h.Role('alert')], [model.episodeError])
        : h.empty,
      model.draft.kind === 'micro' && model.draft.title.length > TWEET_MAX_LENGTH
        ? h.p(
            [h.Class('form-error'), h.Role('alert')],
            [`Tweets are capped at ${TWEET_MAX_LENGTH} characters (${model.draft.title.length}).`],
          )
        : h.empty,
      model.phase === 'published'
        ? h.p(
            [h.Class('creator-published'), h.Role('status')],
            [
              'Published. ',
              h.a(
                [h.Href(`/${publicPath}/${encodeURIComponent(model.draft.slug)}`)],
                ['View post'],
              ),
            ],
          )
        : h.empty,
      model.phase === 'reviewing'
        ? review(model, h, busy, canContinue)
        : h.div(
            [h.Class('creator-workspace')],
            [
              h.main(
                [h.Class('creator-canvas')],
                [
                  h.label(
                    [h.Class('creator-title')],
                    [
                      h.span([h.Class('sr-only')], ['Title']),
                      h.textarea([
                        h.Value(model.draft.title),
                        h.AriaLabel('Title'),
                        h.Rows(1),
                        h.Maxlength(model.draft.kind === 'micro' ? TWEET_MAX_LENGTH + 100 : 500),
                        h.Placeholder(
                          model.draft.kind === 'micro' ? 'What’s playing?' : 'Story title',
                        ),
                        h.OnInput((value) => Message.Changed({ field: 'title', value })),
                      ]),
                      model.draft.kind === 'micro'
                        ? h.small([], [`${model.draft.title.length}/${TWEET_MAX_LENGTH}`])
                        : h.empty,
                    ],
                  ),
                  model.draft.kind !== 'mix' ? musicSlot(model, h, busy) : h.empty,
                  editor(model, h),
                  model.draft.kind === 'mix' ? mixFields(model, h, busy) : h.empty,
                ],
              ),
              metadata(model, h, busy),
            ],
          ),
    ],
  )
})
