import { Match } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { authFormAttribute } from '../../auth-submit'
import type { Message } from '../../message'
import type { Model } from '../../model'
import { authCopy } from './copy'
import { authErrorAction, authErrorMessage, parseAuthErrorKey } from './errors'
import { fieldStates, formFields } from './field-state'
import {
  emailField,
  errorMessage,
  hiddenField,
  nameField,
  passwordField,
  type PasswordReveal,
  statusMessage,
} from './fields'
import { authHref } from './links'
import { invalidResetLink, resetLinkSent, verifyEmail } from './notices'
import { authShell, link } from './shell'

type Builder = HtmlBuilder<Message>

export type AuthViewState = PasswordReveal & Pick<Model, 'authSubmitting'>

const footer = (h: Builder, action: string, returnTo: string): Html =>
  h.p(
    [h.Class('auth-footer')],
    Match.value(action).pipe(
      Match.when('sign-in', () => [
        'New here? ',
        link(h, authHref('/auth/sign-up', { returnTo }), 'Create an account'),
      ]),
      Match.when('sign-up', () => [
        'Already have an account? ',
        link(h, authHref('/auth/sign-in', { returnTo }), 'Sign in'),
      ]),
      Match.orElse(() => [
        'Remembered it? ',
        link(h, authHref('/auth/sign-in', { returnTo }), 'Sign in'),
      ]),
    ),
  )

const authForm = (h: Builder, action: string, url: URL, state: AuthViewState): Html => {
  const copy = authCopy(action)
  const errorKey = parseAuthErrorKey(url.searchParams.get('error'))
  const error = authErrorMessage(errorKey)
  const fields = formFields(action)
  const errorAction = authErrorAction(errorKey)
  const email = url.searchParams.get('email') ?? ''
  const states = fieldStates(action, errorKey)
  const returnTo = url.searchParams.get('returnTo') ?? ''

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
        error === null
          ? h.empty
          : errorMessage(
              h,
              error,
              errorAction === null
                ? h.empty
                : link(h, authHref(errorAction.path, { email, returnTo }), errorAction.label),
            ),
        url.searchParams.has('reset')
          ? statusMessage(h, 'Your password has been reset. Sign in with your new password.')
          : h.empty,
        hiddenField(h, 'token', url.searchParams.get('token') ?? ''),
        hiddenField(h, 'returnTo', returnTo),
        h.div(
          [h.Class('auth-fields')],
          [
            fields.includes('name')
              ? nameField(h, url.searchParams.get('name') ?? '', states.name)
              : h.empty,
            fields.includes('email') ? emailField(h, email, states.email) : h.empty,
            fields.includes('password')
              ? passwordField(
                  h,
                  action === 'sign-in' ? 'current' : 'new',
                  state,
                  authHref('/auth/forgot-password', { returnTo }),
                  states.password,
                )
              : h.empty,
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
        footer(h, action, returnTo),
      ],
    ),
  )
}

const isInvalidResetLink = (action: string, url: URL) =>
  action === 'reset-password' &&
  (!url.searchParams.get('token') || parseAuthErrorKey(url.searchParams.get('error')) === 'token')

export const view = (h: Builder, action: string, url: URL, state: AuthViewState): Html =>
  Match.value(action).pipe(
    Match.when('verify-email', () => verifyEmail(h, url)),
    Match.when(
      () => isInvalidResetLink(action, url),
      () => invalidResetLink(h),
    ),
    Match.when(
      () => action === 'forgot-password' && url.searchParams.has('sent'),
      () => resetLinkSent(h, url.searchParams.get('returnTo') ?? ''),
    ),
    Match.orElse(() => authForm(h, action, url, state)),
  )
