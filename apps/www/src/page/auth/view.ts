import { Match } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { authFormAttribute } from '../../auth-submit'
import type { Message } from '../../message'
import type { Model } from '../../model'
import { authCopy } from './copy'
import { authErrorMessage, parseAuthErrorKey } from './errors'
import {
  emailField,
  errorMessage,
  hiddenField,
  nameField,
  passwordField,
  type PasswordReveal,
  statusMessage,
} from './fields'
import { invalidResetLink, verifyEmail } from './notices'
import { authShell, link } from './shell'

type Builder = HtmlBuilder<Message>

export type AuthViewState = PasswordReveal & Pick<Model, 'authSubmitting'>

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

const authForm = (h: Builder, action: string, url: URL, state: AuthViewState): Html => {
  const copy = authCopy(action)
  const error = authErrorMessage(url.searchParams.get('error'))

  return authShell(
    h,
    h.form(
      [
        h.Class('auth-panel'),
        h.Method('post'),
        h.Action(`/auth/${action}`),
        h.DataAttribute(authFormAttribute, ''),
      ],
      [
        h.header(
          [h.Class('auth-header')],
          [h.h1([], [copy.title]), h.p([h.Class('auth-subtitle')], [copy.subtitle])],
        ),
        error === null ? h.empty : errorMessage(h, error),
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
            action === 'sign-up' ? nameField(h, url.searchParams.get('name') ?? '') : h.empty,
            action === 'reset-password'
              ? h.empty
              : emailField(h, url.searchParams.get('email') ?? ''),
            action === 'forgot-password'
              ? h.empty
              : passwordField(h, action === 'sign-in' ? 'current' : 'new', state),
          ],
        ),
        h.button(
          [
            h.Type('submit'),
            h.Class('auth-submit'),
            h.Disabled(state.authSubmitting),
            h.AriaBusy(state.authSubmitting),
          ],
          [copy.submit],
        ),
        footer(h, action),
      ],
    ),
  )
}

const isInvalidResetLink = (action: string, url: URL) =>
  action === 'reset-password' &&
  (!url.searchParams.get('token') || parseAuthErrorKey(url.searchParams.get('error')) === 'token')

export const view = (h: Builder, action: string, url: URL, state: AuthViewState): Html =>
  Match.value(action).pipe(
    Match.when('verify-email', () => verifyEmail(h)),
    Match.when(
      () => isInvalidResetLink(action, url),
      () => invalidResetLink(h),
    ),
    Match.orElse(() => authForm(h, action, url, state)),
  )
