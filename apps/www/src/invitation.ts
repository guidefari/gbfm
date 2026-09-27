import { inertHtml as h } from 'foldkit/html'

/** The guest-mix invitation remains a public, server-rendered page. */
export const invitationView = () =>
  h.section(
    [h.Class('invitation')],
    [
      h.div(
        [],
        [
          h.p([h.Class('invitation-eyebrow')], ['An invitation']),
          h.h1([], ['hi Charlie! I’d love to host a guest mix from you']),
          h.p(
            [h.Class('invitation-description')],
            [
              'Your Rinse FM residency has become a refuge and a source of so many adored discoveries. I’d love to host and carefully archive some of that magic here, starting with one mix.',
            ],
          ),
          h.div(
            [h.Class('invitation-links')],
            [
              h.a([h.Href('/kimetsu')], ['See kimetsu.’s page']),
              h.a([h.Href('/djs')], ['Meet the residents']),
            ],
          ),
          h.blockquote([], ['Your mix gets a proper page, archived with care.']),
        ],
      ),
      h.aside(
        [],
        [
          h.h2([], ['A guest mix, with room for more']),
          h.dl(
            [],
            [
                ['Stipend', '€100 per mix'],
                ['Format', 'Guest mix on the main show'],
                ['Cadence', 'Start with one, open to more'],
              ].map(([label = '', value = '']) =>
                h.div([], [h.dt([], [label]), h.dd([], [value])]),
              ),
          ),
        ],
      ),
    ],
  )
