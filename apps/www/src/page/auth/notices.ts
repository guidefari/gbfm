import { Match } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../message'
import { authErrorMessages } from './errors'
import { authHref } from './links'
import { link, noticePanel } from './shell'
import { verificationState } from './verification'

type Builder = HtmlBuilder<Message>

export const verifyEmail = (h: Builder, url: URL): Html =>
  Match.value(verificationState(url)).pipe(
    Match.when('verified', () =>
      noticePanel(h, {
        title: 'Email verified',
        subtitle: "Your account is ready and you're signed in.",
        body: h.empty,
        footer: [link(h, '/dashboard', 'Go to your dashboard')],
      }),
    ),
    Match.when('failed', () =>
      noticePanel(h, {
        title: 'Verify your email',
        subtitle: 'This link can no longer be used.',
        body: h.p(
          [h.Role('alert'), h.Class('auth-status auth-error')],
          ['This verification link has expired or was already used.'],
        ),
        footer: [link(h, '/auth/sign-in', 'Sign in')],
      }),
    ),
    Match.orElse(() =>
      noticePanel(h, {
        title: 'Check your email',
        subtitle: 'Use the verification link in your inbox to verify your account.',
        body: h.empty,
        footer: ['Verified? ', link(h, '/auth/sign-in', 'Sign in')],
      }),
    ),
  )

export const invalidResetLink = (h: Builder): Html =>
  noticePanel(h, {
    title: 'Reset your password',
    subtitle: 'This link can no longer be used.',
    body: h.p([h.Role('alert'), h.Class('auth-status auth-error')], [authErrorMessages.token]),
    footer: [link(h, '/auth/forgot-password', 'Request a new link')],
  })

export const resetLinkSent = (h: Builder, returnTo: string): Html =>
  noticePanel(h, {
    title: 'Check your email',
    subtitle: 'If an account exists for that email, a reset link is on its way.',
    body: h.empty,
    footer: [
      'Nothing arrived? ',
      link(h, authHref('/auth/forgot-password', { returnTo }), 'Send another link'),
    ],
  })
