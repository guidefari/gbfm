import * as Popover from '@foldkit/ui/popover'
import { canCreatePosts } from '@gbfm/core/roles'
import type { HtmlBuilder } from 'foldkit/html'

import { Message } from '../message'
import type { Principal } from '../model'

const rowClass =
  'flex min-h-10 w-full items-center rounded-sm px-3 py-2 text-left text-sm text-popover-foreground no-underline transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export const accountMenu = (
  h: HtmlBuilder<Message>,
  principal: Principal,
  model: Popover.Model,
  interactive: boolean,
) => {
  const name = principal.name ?? principal.username ?? '?'

  const item = (href: string, label: string) =>
    h.a([h.Href(href), h.Class(rowClass), h.OnClick(Message.AccountMenuClosed())], [label])

  return h.submodel({
    slotId: 'account-menu',
    model,
    view: Popover.view,
    viewInputs: {
      isDisabled: !interactive,
      ariaLabel: 'Account menu',
      focusSelector: 'a',
      anchor: { placement: 'top-end', gap: 12, padding: 16 },
      toView: ({ button, panel, backdrop, isVisible }) =>
        h.div(
          [h.Class('relative')],
          [
            h.button(
              [
                ...button,
                h.Title(name),
                h.Disabled(!interactive),
                h.Class(
                  'flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-muted p-0 text-xs font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                ),
              ],
              [
                principal.image
                  ? h.img([h.Src(principal.image), h.Alt(''), h.Class('size-full object-cover')])
                  : (name[0] ?? '?'),
              ],
            ),
            ...(isVisible
              ? [
                  h.div([...backdrop, h.Class('account-menu-backdrop')]),
                  h.nav(
                    [...panel, h.AriaLabel('Account'), h.Class('account-menu')],
                    [
                      h.div(
                        [h.Class('border-b border-border px-3 py-2')],
                        [
                          h.p([h.Class('truncate text-base font-semibold')], [name]),
                          principal.username
                            ? h.p(
                                [h.Class('truncate text-xs text-muted-foreground')],
                                [`@${principal.username}`],
                              )
                            : h.empty,
                        ],
                      ),
                      h.div(
                        [h.Class('py-1')],
                        [
                          item('/dashboard', 'Dashboard'),
                          item('/dashboard/profile', 'Edit profile'),
                        ],
                      ),
                      canCreatePosts(principal.role)
                        ? h.div(
                            [h.Class('border-t border-border py-1')],
                            [
                              item('/new', 'New post'),
                              item('/mix-upload', 'New mix'),
                              item('/dashboard/content', 'My content'),
                            ],
                          )
                        : h.empty,
                      h.form(
                        [
                          h.Method('post'),
                          h.Action('/actions/sign-out'),
                          h.Class('border-t border-border pt-1'),
                        ],
                        [
                          h.button(
                            [h.Type('submit'), h.Class(`${rowClass} border-0 bg-transparent`)],
                            ['Log out'],
                          ),
                        ],
                      ),
                    ],
                  ),
                ]
              : []),
          ],
        ),
    },
    toParentMessage: (message) => Message.GotAccountMenuMessage({ message }),
  })
}
