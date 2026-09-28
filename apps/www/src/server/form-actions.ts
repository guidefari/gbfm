import { MicroPostRandomUnreadResponse } from '@gbfm/api/navigation'
import { isRole } from '@gbfm/core/roles'
import { Match, Option, Schema } from 'effect'
import * as Server from 'foldkit/experimental/server'

import { readModeCookie } from '../tweet-navigation'
import { apiRequest } from './api'

export const redirect = (location: string, cookies: ReadonlyArray<string> = []) => {
  const headers = new Headers({ location, 'cache-control': 'private, no-store' })

  for (const cookie of cookies) headers.append('set-cookie', cookie)

  return Server.Responded(new Response(null, { status: 303, headers }))
}

export const handleFormAction = async (request: Request): Promise<Server.Responded> => {
  const url = new URL(request.url)

  if (request.headers.get('origin') !== url.origin)
    return Server.Responded(new Response('Forbidden', { status: 403 }))
  const form = await request.formData()

  const field = (name: string) =>
    Option.getOrElse(Schema.decodeUnknownOption(Schema.String)(form.get(name)), () => '')

  const action = url.pathname

  if (action.startsWith('/actions/admin/')) {
    const operation = action.slice('/actions/admin/'.length)
    const userId = field('userId')
    const role = field('role')

    if ((operation === 'create-user' || operation === 'set-role') && !isRole(role))
      return redirect('/dashboard/users?notice=failed')

    if (operation === 'create-user' && !field('email').trim() && !field('username').trim())
      return redirect('/dashboard/users?notice=failed')

    const payload = Match.value(operation).pipe(
      Match.when('create-user', () => {
        const username = field('username').trim()

        const body = {
          name: field('name').trim() || username || 'User',
          email: field('email').trim() || `${username}@placeholder.local`,
          password: field('password') || crypto.randomUUID(),
          role,
        }

        return username ? { ...body, data: { username } } : body
      }),
      Match.when('set-role', () => ({ userId, role })),
      Match.when('ban-user', () =>
        field('banReason') ? { userId, banReason: field('banReason') } : { userId },
      ),
      Match.whenOr('unban-user', 'remove-user', 'invite', () => ({ userId })),
      Match.orElse(() => null),
    )

    if (!payload) return Server.Responded(new Response('Not found', { status: 404 }))

    const response = await apiRequest(
      request,
      operation === 'invite' ? '/api/invite/send' : `/auth/admin/${operation}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: url.origin },
        body: JSON.stringify(payload),
      },
    )

    const returnQuery = new URLSearchParams({
      notice: response.ok ? 'done' : 'failed',
      search: url.searchParams.get('search') ?? '',
      offset: url.searchParams.get('offset') ?? '0',
    })

    return redirect(`/dashboard/users?${returnQuery}`, response.headers.getSetCookie())
  }

  if (action === '/actions/tweet-read-mode') {
    const mode = field('mode') === 'all' ? 'all' : 'unread'

    return Server.Responded(
      new Response(null, {
        status: 204,
        headers: {
          'cache-control': 'private, no-store',
          'set-cookie': `${readModeCookie}=${mode}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}`,
        },
      }),
    )
  }

  if (action === '/actions/tweet-random') {
    const response = await apiRequest(
      request,
      `/api/content/posts/micro/${encodeURIComponent(field('slug'))}/random`,
      { method: 'GET' },
    )

    if (!response.ok)
      return redirect(`/tweet/${encodeURIComponent(field('slug'))}?random=unavailable`)
    const result = Schema.decodeUnknownSync(MicroPostRandomUnreadResponse)(await response.json())

    return redirect(`/tweet/${encodeURIComponent(result.slug)}`)
  }

  if (action === '/actions/sign-out') {
    const response = await apiRequest(request, '/auth/sign-out', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: url.origin },
      body: '{}',
    })

    if (!response.ok)
      return Server.Responded(
        new Response('Sign out failed. Please try again.', { status: response.status }),
      )

    return redirect('/', response.headers.getSetCookie())
  }

  const newsletterPath = Match.value(action).pipe(
    Match.when('/actions/subscribe', () => '/api/newsletter/subscribe'),
    Match.when('/actions/unsubscribe', () =>
      field('token') ? '/api/newsletter/unsubscribe' : '/api/newsletter/request-unsubscribe',
    ),
    Match.orElse(() => null),
  )

  if (newsletterPath) {
    const response = await apiRequest(request, newsletterPath, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: url.origin },
      body: JSON.stringify(
        field('token') ? { token: field('token') } : { email: field('email'), name: field('name') },
      ),
    })

    if (!response.ok)
      return Server.Responded(
        new Response('The request could not be completed. Please try again.', {
          status: response.status,
          headers: { 'cache-control': 'no-store' },
        }),
      )

    return redirect(
      action === '/actions/subscribe'
        ? '/subscribe?complete=1'
        : `/unsubscribe?complete=${field('token') ? 'removed' : 'requested'}`,
    )
  }

  const authPath = new Map([
    ['/auth/sign-in', '/auth/sign-in/email'],
    ['/auth/sign-up', '/auth/sign-up/email'],
    ['/auth/forgot-password', '/auth/request-password-reset'],
    ['/auth/reset-password', '/auth/reset-password'],
  ]).get(action)

  const path =
    authPath ??
    (action === '/actions/reply'
      ? `/api/content/posts/micro/${encodeURIComponent(url.searchParams.get('slug') ?? '')}/replies`
      : null)

  if (!path) return Server.Responded(new Response('Not found', { status: 404 }))

  const response = await apiRequest(request, path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: url.origin },
    body: JSON.stringify(
      authPath
        ? {
            email: field('email'),
            password: field('password'),
            name: field('name'),
            token: field('token'),
            newPassword: field('password'),
            redirectTo: `${url.origin}/auth/reset-password`,
          }
        : { content: field('content') },
    ),
  })

  if (!response.ok)
    return Server.Responded(
      new Response('The request could not be completed. Check your details and try again.', {
        status: response.status,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      }),
    )

  const returnUrl = URL.parse(field('returnTo') || '/dashboard', url.origin)

  const returnPath =
    returnUrl?.origin === url.origin ? `${returnUrl.pathname}${returnUrl.search}` : '/dashboard'

  return redirect(
    Match.value(action).pipe(
      Match.when('/auth/forgot-password', () => '/auth/forgot-password?sent=1'),
      Match.when('/auth/reset-password', () => '/auth/sign-in?reset=1'),
      Match.orElse(() =>
        authPath ? returnPath : `/tweet/${encodeURIComponent(url.searchParams.get('slug') ?? '')}`,
      ),
    ),
    response.headers.getSetCookie(),
  )
}
