import type { PublicProfileResponse } from '@gbfm/api/profile'
import { inertHtml as h } from 'foldkit/html'

export const profileView = (profile: PublicProfileResponse) => {
  const sections = [
    { title: 'Mixes', path: 'mixes', items: profile.content.mixes },
    { title: 'Shows', path: 'shows', items: profile.content.shows },
    { title: 'Editorial', path: 'editorial', items: profile.content.editorials },
    { title: 'Tweets', path: 'tweet', items: profile.content.tweets },
  ]

  return h.div(
    [h.Class('public-profile')],
    [
      h.aside(
        [],
        [
          profile.image
            ? h.img([h.Src(profile.image), h.Alt(profile.name), h.Class('profile-avatar')])
            : h.empty,
          h.h1([], [profile.name]),
          profile.username ? h.p([h.Class('muted')], [`@${profile.username}`]) : h.empty,
          profile.bio ? h.p([h.Class('content-paragraph')], [profile.bio]) : h.empty,
          h.nav(
            [h.AriaLabel('Social links')],
            profile.socialLinks.map((social) =>
              h.a(
                [h.Href(social.url), h.Target('_blank'), h.Rel('noopener noreferrer')],
                [`${social.platform} ↗`],
              ),
            ),
          ),
        ],
      ),
      h.div(
        [h.Class('profile-content')],
        [
          ...sections.flatMap((section) =>
            section.items.length
              ? [
                  h.section(
                    [],
                    [
                      h.h2([], [section.title]),
                      h.div(
                        [h.Class('cards')],
                        section.items.map((item) =>
                          h.a(
                            [
                              h.Href(`/${section.path}/${encodeURIComponent(item.slug)}`),
                              h.Class('card card-copy'),
                            ],
                            [h.h3([], [item.title || item.slug])],
                          ),
                        ),
                      ),
                    ],
                  ),
                ]
              : [],
          ),
          sections.every((section) => section.items.length === 0)
            ? h.p([], ['No public content yet.'])
            : h.empty,
        ],
      ),
    ],
  )
}
