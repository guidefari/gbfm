import { Match } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from '../message'
import type { Status } from './model'

export const challengeView = (
  h: HtmlBuilder<Message>,
  sitekey: string,
  status: Status,
  submitting: string,
) => [
  h.div([h.DataAttribute('turnstile', '')], []),
  h.p(
    [h.Role('status'), h.AriaLive('polite')],
    [
      Match.value(sitekey ? status : 'unavailable').pipe(
        Match.when(
          'unavailable',
          () => 'Browser verification is unavailable. Please try again later.',
        ),
        Match.when('ready', () => 'Verification complete. You can submit the form.'),
        Match.when(
          'failed',
          () =>
            'Verification or submission failed. Your details are still here. Please retry verification.',
        ),
        Match.when('submitting', () => submitting),
        Match.when('verifying', () => 'Verifying your browser…'),
        Match.exhaustive,
      ),
    ],
  ),
  h.p(
    [h.Class('auth-hint'), h.Hidden(status === 'ready' || status === 'submitting')],
    [
      'JavaScript is required to verify your browser and submit this form. If verification does not start, enable JavaScript and reload this page.',
    ],
  ),
  h.button(
    [h.Type('button'), h.DataAttribute('challenge-retry', ''), h.Hidden(status !== 'failed')],
    ['Retry verification'],
  ),
]
