import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../message'
import type { Status } from '../../signup-challenge/model'
import { SignupChallenge } from '../../signup-challenge/mount'
import { challengeView } from '../../signup-challenge/view'

/** Subscription requires a browser challenge; unsubscribe remains a native server-backed form. */
export const view = (
  h: HtmlBuilder<Message>,
  mode: string,
  url: URL,
  sitekey: string,
  status: Status,
) => {
  const subscribing = mode === 'subscribe'
  const token = url.searchParams.get('token')
  const complete = url.searchParams.get('complete')

  return h.section(
    [h.Class('page auth')],
    [
      h.h1([], [subscribing ? 'Stay in the loop' : 'Unsubscribe']),
      h.p(
        [],
        [
          subscribing
            ? 'New mixes, notable drops, and occasional updates.'
            : 'Leave the mailing list at any time.',
        ],
      ),
      complete
        ? h.p(
            [h.Role('status')],
            [
              subscribing
                ? "You're subscribed."
                : complete === 'removed'
                  ? "You've been removed from the mailing list."
                  : 'Check your inbox for an unsubscribe link.',
            ],
          )
        : h.form(
            [
              h.Key(`newsletter-${mode}-${sitekey}`),
              h.Method('post'),
              h.Action(`/actions/${mode}`),
              ...(subscribing
                ? [h.OnMount(SignupChallenge({ sitekey, action: 'newsletter-subscribe' }))]
                : []),
            ],
            [
              ...(token
                ? [h.input([h.Type('hidden'), h.Name('token'), h.Value(token)])]
                : [
                    ...(subscribing
                      ? [
                          h.label(
                            [],
                            ['Name (optional)', h.input([h.Name('name'), h.Autocomplete('name')])],
                          ),
                        ]
                      : []),
                    h.label(
                      [],
                      [
                        'Email',
                        h.input([
                          h.Name('email'),
                          h.Type('email'),
                          h.Autocomplete('email'),
                          h.Required(true),
                        ]),
                      ],
                    ),
                  ]),
              ...(subscribing ? challengeView(h, sitekey, status, 'Subscribing…') : []),
              h.button(
                [
                  h.Type('submit'),
                  ...(subscribing ? [h.Disabled(status !== 'ready' || !sitekey)] : []),
                ],
                [subscribing ? 'Subscribe' : token ? 'Confirm unsubscribe' : 'Send link'],
              ),
            ],
          ),
    ],
  )
}
