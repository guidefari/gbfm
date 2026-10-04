import * as Dialog from '@foldkit/ui/dialog'
import { canCreatePosts } from '@gbfm/core/roles'
import type { HtmlBuilder } from 'foldkit/html'

import { Message } from '../message'
import type { Model } from '../model'
import { onDragStart } from '../sheet-drag'
import { iconPaths, lucide } from './icons'

const browseIcons = new Map([
  ['/shows', iconPaths.radio],
  ['/editorial', iconPaths.book],
  ['/tweets', iconPaths.message],
  ['/labels', iconPaths.album],
])

export const mobileMenu = (
  h: HtmlBuilder<Message>,
  { mobileMenu: dialogModel, menuDrag, menuOffset, pendingPath, flags: { principal, url } }: Model,
  links: ReadonlyArray<readonly [string, string]>,
) => {
  const pathname = pendingPath ?? new URL(url).pathname
  const icon = (path: string) => lucide(path, 'menu-sheet-icon')

  const link = (href: string, label: string, path: string) =>
    h.a(
      [
        h.Href(href),
        ...(pathname === href || pathname.startsWith(`${href}/`) ? [h.AriaCurrent('page')] : []),
      ],
      [icon(path), label],
    )

  const section = (heading: string, items: ReadonlyArray<ReturnType<typeof link>>) =>
    h.section([h.Class('menu-sheet-section')], [h.h3([], [heading]), ...items])

  return h.submodel({
    slotId: 'mobile-menu',
    model: dialogModel,
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
                  [
                    ...panel,
                    h.Class('menu-sheet'),
                    h.Style({ '--player-drag-y': `${menuOffset}px` }),
                    ...(menuDrag ? [h.DataAttribute('dragging', '')] : []),
                  ],
                  [
                    h.header(
                      [
                        h.OnPointerDown(onDragStart(Message.MenuDragStarted)),
                        h.Class('player-drag-surface'),
                      ],
                      [
                        h.span([h.Class('player-drag-grip'), h.AriaHidden(true)]),
                        h.button([...closeButton, h.Class('sr-only')], ['Close menu']),
                      ],
                    ),
                    h.nav(
                      [h.Class('menu-sheet-links'), h.AriaLabel('Menu links')],
                      [
                        section('Browse', [
                          ...links.flatMap(([href, label]) =>
                            href === '/about'
                              ? []
                              : [link(href, label, browseIcons.get(href) ?? iconPaths.link)],
                          ),
                          link('/mixes', 'Mixes', iconPaths.disc),
                          link('/subscribe', 'Subscribe', iconPaths.mail),
                          link('/about', 'About', iconPaths.info),
                        ]),
                        canCreatePosts(principal?.role ?? null)
                          ? section('Create', [
                              link('/new', 'New post', iconPaths.edit),
                              link('/mix-upload', 'New mix', iconPaths.upload),
                              link('/dashboard/content', 'My content', iconPaths.list),
                            ])
                          : h.empty,
                        section('Follow', [
                          link('/rss.xml', 'Mixes via RSS', iconPaths.rss),
                          link(
                            'https://youtube.com/@goosebumpsfm',
                            'Mixes via YouTube',
                            iconPaths.youtube,
                          ),
                        ]),
                        section('Account', [
                          principal
                            ? link('/dashboard', 'Dashboard', iconPaths.dashboard)
                            : link('/auth/sign-in', 'Log in', iconPaths.logIn),
                          principal
                            ? h.form(
                                [h.Method('post'), h.Action('/actions/sign-out')],
                                [
                                  h.button(
                                    [h.Type('submit')],
                                    [icon(iconPaths.logOut), 'Sign out'],
                                  ),
                                ],
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
