import { inertHtml as h } from 'foldkit/html'

/** Server-backed newsletter forms work before hydration and require an explicit token confirmation. */
export const newsletterView = (mode: string, url: URL) => {
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
            [h.Method('post'), h.Action(`/actions/${mode}`)],
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
              h.button(
                [h.Type('submit')],
                [subscribing ? 'Subscribe' : token ? 'Confirm unsubscribe' : 'Send link'],
              ),
            ],
          ),
    ],
  )
}
