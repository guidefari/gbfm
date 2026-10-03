import { canCreatePosts } from '@gbfm/core/roles'
import type { HtmlBuilder } from 'foldkit/html'

import type { Principal } from '../model'

const rowClass =
  'flex min-h-10 w-full items-center rounded-sm px-3 py-2 text-left text-sm text-popover-foreground no-underline transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export const accountMenu = <M>(
  h: HtmlBuilder<M>,
  principal: Principal,
  close: M,
  interactive: boolean,
) => {
  const name = principal.name ?? principal.username ?? '?'

  const item = (href: string, label: string, autofocus = false) =>
    h.a([h.Href(href), h.Class(rowClass), h.OnClick(close), h.Autofocus(autofocus)], [label])

  return h.div(
    [],
    [
      h.button(
        [
          h.Type('button'),
          h.AriaLabel('Account menu'),
          h.Title(name),
          h.Disabled(!interactive),
          h.Popovertarget('account-menu'),
          h.Class(
            'flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-muted p-0 text-xs font-bold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          ),
        ],
        [name[0] ?? '?'],
      ),
      h.nav(
        [h.Id('account-menu'), h.Popover('auto'), h.AriaLabel('Account'), h.Class('account-menu')],
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
            [item('/dashboard', 'Dashboard', true), item('/dashboard/profile', 'Edit profile')],
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
    ],
  )
}
