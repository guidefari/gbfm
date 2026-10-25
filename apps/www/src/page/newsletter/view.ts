import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../message'
import type { Status } from '../../signup-challenge/model'
import { SignupChallenge } from '../../signup-challenge/mount'
import { challengeView } from '../../signup-challenge/view'
import { emailField, hiddenField, statusMessage } from '../auth/fields'
import { authShell, link } from '../auth/shell'

type Builder = HtmlBuilder<Message>

const header = (h: Builder, title: string, subtitle: string): Html =>
  h.header(
    [h.Class('auth-header')],
    [h.h1([], [title]), h.p([h.Class('auth-subtitle')], [subtitle])],
  )

const nameField = (h: Builder): Html =>
  h.label(
    [h.Class('auth-field')],
    [
      h.span(
        [h.Class('auth-label')],
        ['Name ', h.span([h.Class('auth-optional')], ['(optional)'])],
      ),
      h.input([h.Name('name'), h.Autocomplete('name')]),
    ],
  )

const footer = (h: Builder, subscribing: boolean): Html =>
  h.p(
    [h.Class('auth-footer')],
    subscribing
      ? ['Free, and you can ', link(h, '/unsubscribe', 'unsubscribe'), ' at any time.']
      : ['Changed your mind? ', link(h, '/subscribe', 'Get email updates')],
  )

const completeMessage = (subscribing: boolean, complete: string) =>
  subscribing
    ? "You're subscribed."
    : complete === 'removed'
      ? "You've been removed from the mailing list."
      : 'Check your inbox for an unsubscribe link.'

/** Subscription requires a browser challenge; unsubscribe remains a native server-backed form. */
export const view = (h: Builder, mode: string, url: URL, sitekey: string, status: Status) => {
  const subscribing = mode === 'subscribe'
  const token = url.searchParams.get('token')
  const complete = url.searchParams.get('complete')
  const title = subscribing ? 'Email updates' : 'Unsubscribe'

  const subtitle = subscribing
    ? 'New mixes, notable drops, and occasional news from goosebumps.fm.'
    : 'Leave the mailing list at any time.'

  if (complete)
    return authShell(
      h,
      h.div(
        [h.Class('auth-panel')],
        [
          header(h, title, subtitle),
          statusMessage(h, completeMessage(subscribing, complete)),
          h.p([h.Class('auth-footer')], [link(h, '/', 'Back to goosebumps.fm')]),
        ],
      ),
    )

  return authShell(
    h,
    h.form(
      [
        h.Key(`newsletter-${mode}-${sitekey}`),
        h.Class('auth-panel'),
        h.Method('post'),
        h.Action(`/actions/${mode}`),
        ...(subscribing
          ? [h.OnMount(SignupChallenge({ sitekey, action: 'newsletter-subscribe' }))]
          : []),
      ],
      [
        header(h, title, subtitle),
        token
          ? hiddenField(h, 'token', token)
          : h.div(
              [h.Class('auth-fields')],
              [
                subscribing ? nameField(h) : h.empty,
                emailField(h, '', { invalid: false, focus: false }),
              ],
            ),
        ...(subscribing ? challengeView(h, sitekey, status, 'Subscribing…') : []),
        h.button(
          [
            h.Type('submit'),
            h.Class('auth-submit'),
            ...(subscribing ? [h.Disabled(status !== 'ready' || !sitekey)] : []),
          ],
          [subscribing ? 'Subscribe' : token ? 'Confirm unsubscribe' : 'Send link'],
        ),
        footer(h, subscribing),
      ],
    ),
  )
}
