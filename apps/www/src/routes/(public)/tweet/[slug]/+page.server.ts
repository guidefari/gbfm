import { MicroPostNeighboursResponse, MicroPostRandomUnreadResponse } from '@gbfm/api/navigation'
import {
  CompiledMicroPostResponse,
  MicroPostScreenRepliesResponse,
  MicroPostScreenResponse,
} from '@gbfm/api/post'
import { error, fail, redirect } from '@sveltejs/kit'
import { Effect, Option, Result, Schema } from 'effect'

import { parseReadMode, READ_MODE_COOKIE } from '@/lib/components/tweet/read-mode'
import { apiJson } from '@/lib/server/api/api-json'

import type { Actions, PageServerLoad } from './$types'

const microPost = (slug: string) => `/api/content/posts/micro/${encodeURIComponent(slug)}`

export const load = (async (event) => {
  const path = microPost(event.params.slug)

  const neighbours = Effect.runPromise(
    apiJson(event, `${path}/neighbours`, MicroPostNeighboursResponse).pipe(
      Effect.orElseSucceed(() => null),
    ),
  )

  const replies = Effect.runPromise(
    apiJson(event, `${path}/screen/replies`, MicroPostScreenRepliesResponse).pipe(
      Effect.orElseSucceed(() => null),
    ),
  )

  const screen = await Effect.runPromise(
    Effect.result(apiJson(event, `${path}/screen?part=main`, MicroPostScreenResponse)),
  )

  if (Result.isFailure(screen)) {
    error(
      screen.failure.status === 404 ? 404 : 503,
      screen.failure.status === 404
        ? 'This tweet could not be found.'
        : 'Content is unavailable right now.',
    )
  }

  return {
    screen: screen.success,
    replies,
    neighbours,
    readMode: parseReadMode(event.cookies.get(READ_MODE_COOKIE)),
  }
}) satisfies PageServerLoad

const replyContent = (form: FormData) =>
  Option.getOrElse(Schema.decodeUnknownOption(Schema.String)(form.get('content')), () => '').trim()

export const actions = {
  readMode: async (event) => {
    const readMode = parseReadMode((await event.request.formData()).get('mode'))

    event.cookies.set(READ_MODE_COOKIE, readMode, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    })

    return { readMode }
  },
  reply: async (event) => {
    const content = replyContent(await event.request.formData())

    if (!content) return fail(400, { reply: { content, message: 'Write a reply first' } })

    const posted = await Effect.runPromise(
      Effect.result(
        apiJson(event, `${microPost(event.params.slug)}/replies`, CompiledMicroPostResponse, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content }),
        }),
      ),
    )

    if (Result.isFailure(posted)) {
      const status = posted.failure.status === 401 ? 401 : 502

      return fail(status, {
        reply: {
          content,
          message: status === 401 ? 'Sign in to reply' : 'Could not post reply',
        },
      })
    }

    return { reply: { content: '', message: 'Reply posted' } }
  },
  random: async (event) => {
    const picked = await Effect.runPromise(
      Effect.result(
        apiJson(event, `${microPost(event.params.slug)}/random`, MicroPostRandomUnreadResponse),
      ),
    )

    if (Result.isFailure(picked)) return fail(404, { random: 'No unread tweets left' })

    return redirect(303, `/tweet/${encodeURIComponent(picked.success.slug)}`)
  },
} satisfies Actions
