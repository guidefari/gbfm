import type { HtmlBuilder } from 'foldkit/html'

import { Message } from '../../message'
import type { Model } from '../../model'
import { formatDate } from '../../view/format-date'
import { iconPaths, lucide } from '../../view/icons'
import {
  authorRow,
  cardActions,
  musicCard,
  parentPreview,
  quoteCard,
  replyCard,
  replySkeleton,
  tagLinks,
  tweetBody,
  type TweetPost,
} from './card'
import { tweetWayfinder } from './wayfinder'

const tweetArrow = (
  h: HtmlBuilder<Message>,
  direction: 'newer' | 'older',
  slug: string | null | undefined,
  flank: boolean,
) => {
  const path = direction === 'newer' ? iconPaths.chevronLeft : iconPaths.chevronRight
  const iconClassName = flank ? 'h-6 w-6' : 'h-4 w-4'

  const base = flank
    ? `fixed top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors lg:flex ${
        direction === 'newer'
          ? 'left-[max(1rem,calc(50%-30rem))]'
          : 'right-[max(1rem,calc(50%-30rem))]'
      }`
    : 'inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors'

  if (!slug)
    return h.span(
      [h.AriaHidden(true), h.Class(`${base} cursor-not-allowed text-muted-foreground/20`)],
      [lucide(path, iconClassName)],
    )

  return h.a(
    [
      ...(flank ? [h.Id(`tweet-${direction}`)] : []),
      h.Href(`/tweet/${encodeURIComponent(slug)}`),
      h.AriaLabel(direction === 'newer' ? 'Newer tweet' : 'Older tweet'),
      h.Class(`${base} no-underline hover:bg-muted/60 hover:text-foreground`),
    ],
    [lucide(path, iconClassName)],
  )
}

export const view = (model: Model, h: HtmlBuilder<Message>) => {
  const screen = model.flags.tweet

  if (!screen)
    return h.div(
      [h.Class('max-w-3xl px-4 pt-8 mx-auto')],
      [h.p([h.Role('alert')], [model.flags.failure ?? 'Tweet not found.'])],
    )
  const neighbours = model.flags.neighbours
  const older = model.skipSeen ? (neighbours?.olderUnread ?? neighbours?.older) : neighbours?.older
  const post = screen.post
  const principal = model.flags.principal

  const canEdit = (candidate: TweetPost) =>
    Boolean(
      principal &&
      (principal.role === 'admin' ||
        candidate.creators?.some((creator) => creator.id === principal.id)),
    )

  const editedAt = post.updatedAt > post.createdAt ? post.updatedAt : null
  const replies = screen.replies

  return h.div(
    [h.Class('max-w-3xl px-4 py-8 mx-auto')],
    [
      tweetWayfinder(neighbours, post.createdAt, model.flags.renderedAt),
      h.div(
        [h.Class('mb-6 flex items-center gap-1 text-xs text-muted-foreground')],
        [
          h.div(
            [h.Class('flex items-center gap-1 lg:hidden')],
            [
              tweetArrow(h, 'newer', neighbours?.newer, false),
              tweetArrow(h, 'older', older, false),
            ],
          ),
          h.form(
            [h.Method('post'), h.Action('/actions/tweet-random'), h.Class('m-0')],
            [
              h.input([h.Type('hidden'), h.Name('slug'), h.Value(post.slug)]),
              h.button(
                [
                  h.Type('submit'),
                  h.Disabled(!neighbours?.unreadCount),
                  h.Class(
                    'inline-flex h-8 items-center gap-1.5 rounded-sm border-0 bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40',
                  ),
                ],
                [lucide(iconPaths.shuffle, 'h-3.5 w-3.5'), 'Random unread'],
              ),
            ],
          ),
          h.label(
            [h.Class('ml-auto inline-flex cursor-pointer items-center gap-2')],
            [
              h.input([
                h.Type('checkbox'),
                h.Disabled(!model.interactive),
                h.Checked(model.skipSeen),
                h.OnClick(Message.SkipSeenChanged({ value: !model.skipSeen })),
              ]),
              'Skip seen',
            ],
          ),
        ],
      ),
      tweetArrow(h, 'newer', neighbours?.newer, true),
      tweetArrow(h, 'older', older, true),
      new URL(model.flags.url).searchParams.has('random')
        ? h.p(
            [h.Role('alert'), h.Class('mb-4 text-sm text-destructive')],
            ['No unread tweet could be loaded. Try again.'],
          )
        : h.empty,
      post.parentPostId && screen.root.id !== post.id ? parentPreview(screen.root) : h.empty,
      h.article(
        [
          h.Class(
            'space-y-4 rounded-lg border border-border/60 bg-card/60 p-4 shadow-sm sm:p-5 animate-in fade-in duration-300',
          ),
        ],
        [
          h.div(
            [h.Class('space-y-1')],
            [
              authorRow(post.creators ?? [], post.createdAt),
              editedAt
                ? h.p(
                    [
                      h.Class(
                        'pl-[52px] font-mono text-[11px] tracking-wider text-muted-foreground/60',
                      ),
                    ],
                    [`Edited ${formatDate(editedAt)}`],
                  )
                : h.empty,
            ],
          ),
          post.title
            ? h.h1([h.Class('m-0 text-lg font-medium leading-snug tracking-tight')], [post.title])
            : h.empty,
          tweetBody(post, 'base'),
          post.music ? musicCard(post.music, true) : h.empty,
          screen.quote ? quoteCard(screen.quote) : h.empty,
          post.tags?.length ? h.div([h.Class('pt-1')], [tagLinks(post.tags)]) : h.empty,
          h.div(
            [h.Class('border-t border-border/40 pt-3')],
            [cardActions(post, canEdit(post), replies.length)],
          ),
        ],
      ),
      h.div(
        [h.Id('replies'), h.Class('mt-6 scroll-mt-4 space-y-4')],
        [
          principal
            ? h.form(
                [
                  h.Method('post'),
                  h.Action(`/actions/reply?slug=${encodeURIComponent(post.slug)}`),
                  h.Class('space-y-2 rounded-lg border border-border/60 bg-card/60 p-3'),
                ],
                [
                  h.textarea([
                    h.Name('content'),
                    h.Required(true),
                    h.Placeholder('Write a reply…'),
                    h.AriaLabel('Reply'),
                    h.Class(
                      'h-20 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm',
                    ),
                  ]),
                  h.div(
                    [h.Class('flex justify-end')],
                    [
                      h.button(
                        [
                          h.Type('submit'),
                          h.Class(
                            'inline-flex h-8 items-center rounded-sm border-0 bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90',
                          ),
                        ],
                        ['Reply'],
                      ),
                    ],
                  ),
                ],
              )
            : h.p(
                [h.Class('text-base')],
                [
                  h.a(
                    [h.Href(`/auth/sign-in?returnTo=${encodeURIComponent(`/tweet/${post.slug}`)}`)],
                    ['Sign in'],
                  ),
                  ' to reply',
                ],
              ),
          model.repliesStatus === 'loading' ? replySkeleton() : h.empty,
          model.repliesStatus === 'error'
            ? h.p(
                [h.Role('alert'), h.Class('text-sm text-muted-foreground')],
                ['Replies are unavailable. Please reload to try again.'],
              )
            : h.empty,
          replies.length > 0
            ? h.div(
                [],
                replies.map((reply, index) =>
                  replyCard(reply, index === replies.length - 1, canEdit(reply)),
                ),
              )
            : h.empty,
        ],
      ),
    ],
  )
}
