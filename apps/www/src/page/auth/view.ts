import { Match } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../message'
import { authCopy } from './copy'
import { emailField, hiddenField, nameField, passwordField, statusMessage } from './fields'

type Builder = HtmlBuilder<Message>

const link = (h: Builder, href: string, label: string) => h.a([h.Href(href)], [label])

const verifyEmail = (h: Builder): Html =>
  h.section(
    [h.Class('page narrow')],
    [
      h.h1([], ['Check your email']),
      h.p([], ['Use the verification link in your inbox to verify your account.']),
      link(h, '/auth/sign-in', 'Sign in'),
    ],
  )

const footer = (h: Builder, action: string): Html =>
  h.p(
    [h.Class('auth-footer')],
    Match.value(action).pipe(
      Match.when('sign-in', () => ['New here? ', link(h, '/auth/sign-up', 'Create an account')]),
      Match.when('sign-up', () => [
        'Already have an account? ',
        link(h, '/auth/sign-in', 'Sign in'),
      ]),
      Match.orElse(() => ['Remembered it? ', link(h, '/auth/sign-in', 'Sign in')]),
    ),
  )

const authForm = (h: Builder, action: string, url: URL): Html => {
  const copy = authCopy(action)

  return h.section(
    [h.Class('auth-page')],
    [
      h.form(
        [h.Class('auth-panel'), h.Method('post'), h.Action(`/auth/${action}`)],
        [
          h.header(
            [h.Class('auth-header')],
            [h.h1([], [copy.title]), h.p([h.Class('auth-subtitle')], [copy.subtitle])],
          ),
          url.searchParams.has('sent')
            ? statusMessage(h, 'Check your inbox for a password reset link.')
            : h.empty,
          url.searchParams.has('reset')
            ? statusMessage(h, 'Your password has been reset. Sign in with your new password.')
            : h.empty,
          hiddenField(h, 'token', url.searchParams.get('token') ?? ''),
          hiddenField(h, 'returnTo', url.searchParams.get('returnTo') ?? '/dashboard'),
          h.div(
            [h.Class('auth-fields')],
            [
              action === 'sign-up' ? nameField(h) : h.empty,
              action === 'reset-password' ? h.empty : emailField(h),
              action === 'forgot-password'
                ? h.empty
                : passwordField(
                    h,
                    action === 'sign-in' ? 'current-password' : 'new-password',
                    action === 'sign-in',
                  ),
            ],
          ),
          h.button([h.Type('submit'), h.Class('auth-submit')], [copy.submit]),
          footer(h, action),
        ],
      ),
    ],
  )
}

export const view = (h: Builder, action: string, url: URL): Html =>
  action === 'verify-email' ? verifyEmail(h) : authForm(h, action, url)
