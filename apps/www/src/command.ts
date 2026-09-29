import { MicroPostScreenRepliesResponse } from '@gbfm/api/post'
import { SiteMetadata } from '@gbfm/site-metadata'
import { Effect, Schema } from 'effect'
import { Command, Navigation } from 'foldkit'

import * as Creator from './creator'
import { updateDocumentHead } from './document-head'
import { Message } from './message'
import { Flags } from './model'
import { pageKey } from './page-cache'
import { showImages } from './shows/document'
import { tweetImages } from './tweet/card'
import { preloadArtwork } from './view/artwork'

export const StartClient = Command.define('Application.Start', {
  messages: [Message.ClientStarted],
  execute: Effect.succeed(Message.ClientStarted()),
})

export const PauseCreatorUpload = Command.define('Application.PauseCreatorUpload', {
  messages: [Message.NavigationCompleted],
  execute: Effect.flatMap(Creator.CreatorUpload, (upload) => upload.pause).pipe(
    Effect.as(Message.NavigationCompleted()),
  ),
})

export const LoadReplies = Command.define('Tweet.LoadReplies', {
  args: { slug: Schema.String },
  messages: [Message.LoadedReplies, Message.FailedReplies],
  execute: ({ slug }) =>
    Effect.tryPromise(async (signal) => {
      const response = await fetch(
        `/api/content/posts/micro/${encodeURIComponent(slug)}/screen/replies`,
        { signal },
      )

      if (!response.ok) throw new Error('Replies unavailable')

      return response.json()
    }).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(MicroPostScreenRepliesResponse)),
      Effect.map((replies) => Message.LoadedReplies({ slug, replies })),
      Effect.catch(() => Effect.succeed(Message.FailedReplies({ slug }))),
    ),
})

export const MarkSeen = Command.define('Tweet.MarkSeen', {
  args: { slug: Schema.String },
  messages: [Message.NavigationCompleted],
  execute: ({ slug }) =>
    Effect.tryPromise((signal) =>
      fetch(`/api/content/posts/micro/${encodeURIComponent(slug)}/seen`, {
        method: 'POST',
        credentials: 'same-origin',
        signal,
      }),
    ).pipe(
      Effect.as(Message.NavigationCompleted()),
      Effect.orElseSucceed(() => Message.NavigationCompleted()),
    ),
})

export const Navigate = Command.define('Navigation.Push', {
  args: { href: Schema.String },
  messages: [Message.NavigationCompleted],
  execute: ({ href }) => Navigation.pushUrl(href).pipe(Effect.as(Message.NavigationCompleted())),
})

export const SaveReadMode = Command.define('Tweet.SaveReadMode', {
  args: { value: Schema.Boolean },
  messages: [Message.NavigationCompleted, Message.ReadModeFailed],
  execute: ({ value }) =>
    Effect.tryPromise(async (signal) => {
      const response = await fetch('/actions/tweet-read-mode', {
        method: 'POST',
        signal,
        credentials: 'same-origin',
        body: new URLSearchParams({ mode: value ? 'unread' : 'all' }),
      })

      if (!response.ok) throw new Error('Read mode save failed')
    }).pipe(
      Effect.as(Message.NavigationCompleted()),
      Effect.orElseSucceed(() => Message.ReadModeFailed()),
    ),
})

export const Leave = Command.define('Navigation.Leave', {
  args: { href: Schema.String },
  messages: [Message.NavigationCompleted],
  execute: ({ href }) => Navigation.load(href).pipe(Effect.as(Message.NavigationCompleted())),
})

export const SetResolvedUrl = Command.define('Navigation.SetResolvedUrl', {
  args: { href: Schema.String, metadata: Schema.NullOr(SiteMetadata), noindex: Schema.Boolean },
  messages: [Message.NavigationCompleted],
  execute: ({ href, metadata, noindex }) =>
    Effect.sync(() => {
      const target = new URL(href)

      if (metadata) updateDocumentHead(metadata, noindex)

      if (`${location.pathname}${location.search}` !== `${target.pathname}${target.search}`)
        history.replaceState(history.state, '', `${target.pathname}${target.search}`)

      return Message.NavigationCompleted()
    }),
})

const fetchPage = (href: string) =>
  Effect.tryPromise(async (signal) => {
    const url = new URL(href, location.href)
    url.searchParams.set('__data', '1')

    const response = await fetch(url, {
      headers: { accept: 'text/html' },
      credentials: 'same-origin',
      signal,
    })

    return await response.json()
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Flags)))

export const PrefetchPage = Command.define('Navigation.Prefetch', {
  args: { href: Schema.String },
  messages: [Message.PrefetchedPage, Message.NavigationCompleted],
  execute: ({ href }) =>
    fetchPage(href).pipe(
      Effect.tap((flags) =>
        Effect.promise(() =>
          Promise.all(
            [
              ...(flags.tweet ? tweetImages(flags.tweet) : []),
              ...(flags.shows ? showImages(flags.shows) : []),
            ].map(({ src, sizes }) => preloadArtwork(src, sizes)),
          ),
        ),
      ),
      Effect.map((flags) => Message.PrefetchedPage({ flags, key: pageKey(href) })),
      Effect.catch(() => Effect.succeed(Message.NavigationCompleted())),
    ),
})

export const LoadPage = Command.define('Navigation.Load', {
  args: { href: Schema.String, navigationId: Schema.Number },
  messages: [Message.LoadedPage, Message.FailedPage],
  execute: ({ href, navigationId }) =>
    Effect.sync(() => window.dispatchEvent(new Event('gbfm:navigation-start'))).pipe(
      Effect.andThen(fetchPage(href)),
      Effect.tap(() =>
        Effect.sync(() => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => window.dispatchEvent(new Event('gbfm:navigation-end'))),
          )
        }),
      ),
      Effect.map((flags) => Message.LoadedPage({ flags, key: pageKey(href), navigationId })),
      Effect.catch(() => Effect.succeed(Message.FailedPage({ key: pageKey(href), navigationId }))),
    ),
})
