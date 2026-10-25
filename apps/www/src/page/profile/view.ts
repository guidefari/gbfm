import type { PublicProfileResponse } from '@gbfm/api/profile'
import { inertHtml as h } from 'foldkit/html'

import { contentSection } from './content-section'
import { socialLinks } from './social-links'

export const view = (profile: PublicProfileResponse) => {
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
        [h.Class('profile-identity')],
        [
          profile.image
            ? h.img([h.Src(profile.image), h.Alt(profile.name), h.Class('profile-avatar')])
            : h.empty,
          h.p([h.Class('profile-eyebrow')], ['On Goosebumps']),
          h.h1([], [profile.name]),
          profile.username ? h.p([h.Class('muted')], [`@${profile.username}`]) : h.empty,
          profile.bio ? h.p([h.Class('content-paragraph')], [profile.bio]) : h.empty,
          socialLinks(profile.socialLinks),
        ],
      ),
      h.div(
        [h.Class('profile-content')],
        [
          ...sections.map((section) => contentSection(section.title, section.path, section.items)),
          sections.every((section) => section.items.length === 0)
            ? h.p([], ['No public content yet.'])
            : h.empty,
        ],
      ),
    ],
  )
}
