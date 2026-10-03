import * as Dialog from '@foldkit/ui/dialog'
import { canCreatePosts } from '@gbfm/core/roles'
import type { HtmlBuilder } from 'foldkit/html'

import { Message } from '../message'
import type { Principal } from '../model'

export const mobileMenu = (
  h: HtmlBuilder<Message>,
  model: Dialog.Model,
  principal: Principal | null,
  links: ReadonlyArray<readonly [string, string]>,
) => {
  const link = (href: string, label: string) => h.a([h.Href(href)], [label])

  const section = (heading: string, items: ReadonlyArray<ReturnType<typeof link>>) =>
    h.section([h.Class('menu-sheet-section')], [h.h3([], [heading]), ...items])

  return h.submodel({
    slotId: 'mobile-menu',
    model,
    view: Dialog.view,
    viewInputs: {
      toView: ({ dialog, backdrop, panel, title, initialFocus, closeButton, isVisible }) =>
        h.dialog(
          [...dialog, h.Class('mobile-menu-dialog')],
          isVisible
            ? [
                h.span([...title, ...initialFocus, h.Tabindex(-1), h.Class('sr-only')], ['Menu']),
                h.div([...backdrop, h.Class('mobile-menu-backdrop')]),
                h.div(
                  [...panel, h.Class('menu-sheet')],
                  [
                    h.header(
                      [],
                      [
                        h.span([h.Class('player-drag-grip'), h.AriaHidden(true)]),
                        h.button(
                          [...closeButton, h.Class('menu-sheet-close'), h.AriaLabel('Close menu')],
                          ['×'],
                        ),
                      ],
                    ),
                    h.nav(
                      [h.Class('menu-sheet-links'), h.AriaLabel('Menu links')],
                      [
                        section('Browse', [
                          ...links.map(([href, label]) => link(href, label)),
                          link('/mixes', 'Mixes'),
                          link('/subscribe', 'Subscribe'),
                        ]),
                        canCreatePosts(principal?.role ?? null)
                          ? section('Create', [
                              link('/new', 'New post'),
                              link('/mix-upload', 'New mix'),
                              link('/dashboard/content', 'My content'),
                            ])
                          : h.empty,
                        section('Follow', [
                          link('/rss.xml', 'Mixes via RSS'),
                          link('https://youtube.com/@goosebumpsfm', 'Mixes via YouTube'),
                        ]),
                        section('Account', [
                          link(
                            principal ? '/dashboard' : '/auth/sign-in',
                            principal ? 'Dashboard' : 'Log in',
                          ),
                          principal
                            ? h.form(
                                [h.Method('post'), h.Action('/actions/sign-out')],
                                [h.button([h.Type('submit')], ['Sign out'])],
                              )
                            : h.empty,
                        ]),
                      ],
                    ),
                  ],
                ),
              ]
            : [],
        ),
    },
    toParentMessage: (message) => Message.GotMobileMenuMessage({ message }),
  })
}
