import { ROLES } from '@gbfm/core/roles'
import { Schema } from 'effect'
import { inertHtml as h } from 'foldkit/html'

import { badge, dataTable, drawer, emptyState, frame, pageHeader, pageRange, pager } from '../ui'

export const AdminUsers = Schema.Struct({
  users: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      email: Schema.String,
      username: Schema.optional(Schema.NullOr(Schema.String)),
      role: Schema.optional(Schema.NullOr(Schema.String)),
      banned: Schema.optional(Schema.NullOr(Schema.Boolean)),
      banReason: Schema.optional(Schema.NullOr(Schema.String)),
      emailVerified: Schema.optional(Schema.Boolean),
    }),
  ),
  total: Schema.Number,
  limit: Schema.Number,
  offset: Schema.optional(Schema.Number),
})

type AdminUser = (typeof AdminUsers.Type)['users'][number]

const hidden = (name: string, value: string) =>
  h.input([h.Type('hidden'), h.Name(name), h.Value(value)])

const field = (label: string, name: string, type = 'text') =>
  h.label([], [label, h.input([h.Name(name), h.Type(type)])])

const roleSelect = (selected: string) =>
  h.select(
    [h.Name('role'), h.AriaLabel('Role')],
    ROLES.map((role) => h.option([h.Value(role), h.Selected(role === selected)], [role])),
  )

const statusBadge = (user: AdminUser) =>
  user.banned
    ? badge(h, 'Banned', 'error', user.banReason ?? undefined)
    : user.emailVerified === false
      ? badge(h, 'Unverified', 'warn')
      : badge(h, 'Active', 'ok')

const usersHref = (query: string, offset: number) =>
  `/dashboard/users?${new URLSearchParams({ search: query, offset: String(offset) })}`

export const usersView = (
  users: typeof AdminUsers.Type | undefined,
  query: string,
  offset: number,
  notice: string,
) => {
  const action = (name: string) => [
    h.Method('post'),
    h.Action(
      `/actions/admin/${name}?${new URLSearchParams({ search: query, offset: String(offset) })}`,
    ),
  ]

  const menu = (user: AdminUser) =>
    h.details(
      [h.Class('admin-menu')],
      [
        h.summary([h.Class('admin-button-small')], ['More']),
        h.div(
          [h.Class('admin-menu-body')],
          [
            h.form(action('invite'), [
              hidden('userId', user.id),
              h.button([h.Type('submit')], ['Invite']),
            ]),
            user.banned
              ? h.form(action('unban-user'), [
                  hidden('userId', user.id),
                  h.button([h.Type('submit')], ['Unban']),
                ])
              : h.details(
                  [],
                  [
                    h.summary([], ['Ban']),
                    h.form(
                      [...action('ban-user'), h.Class('dashboard-form')],
                      [
                        hidden('userId', user.id),
                        field('Ban reason (optional)', 'banReason'),
                        h.button([h.Type('submit')], ['Confirm ban']),
                      ],
                    ),
                  ],
                ),
            h.details(
              [],
              [
                h.summary([], ['Delete']),
                h.form(
                  [...action('remove-user'), h.Class('dashboard-form')],
                  [
                    hidden('userId', user.id),
                    h.p([], [`Permanently delete ${user.name}? This cannot be undone.`]),
                    h.button([h.Type('submit')], ['Confirm delete']),
                  ],
                ),
              ],
            ),
          ],
        ),
      ],
    )

  return h.div(
    [h.Class('admin-page')],
    [
      pageHeader(h, 'Accounts, roles and access.', [
        drawer(h, 'New user', [
          h.form(
            [...action('create-user'), h.Class('dashboard-form admin-form-grid')],
            [
              field('Display name', 'name'),
              field('Username', 'username'),
              field('Email', 'email', 'email'),
              field('Password (optional)', 'password', 'password'),
              h.label([], ['Role', roleSelect('user')]),
              h.p(
                [h.Class('admin-description')],
                [
                  'Provide an email or username. A blank password is generated securely. Use Invite to send access instructions.',
                ],
              ),
              h.button([h.Type('submit'), h.Class('dashboard-button-primary')], ['Create account']),
            ],
          ),
        ]),
      ]),
      notice
        ? h.p(
            [h.Role(notice === 'failed' ? 'alert' : 'status'), h.Class('admin-notice')],
            [
              notice === 'failed'
                ? 'The account action failed. Your access or the submitted values may have changed.'
                : 'Account action completed.',
            ],
          )
        : h.empty,
      frame(h, [
        h.form(
          [
            h.Method('get'),
            h.Action('/dashboard/users'),
            h.Role('search'),
            h.Class('admin-toolbar'),
          ],
          [
            h.input([
              h.Type('search'),
              h.Name('search'),
              h.AriaLabel('Search by email'),
              h.Placeholder('Search by email'),
              h.Attribute('value', query),
            ]),
            h.button([h.Type('submit')], ['Search users']),
            query
              ? h.a([h.Href('/dashboard/users'), h.Class('admin-toolbar-end')], ['Clear'])
              : h.empty,
          ],
        ),
        !users
          ? h.p([h.Role('alert'), h.Class('admin-empty')], ['Could not load user accounts.'])
          : dataTable(h, {
              label: 'User accounts',
              minWidth: '48rem',
              columns: [
                { label: 'User' },
                { label: 'Username', width: '18%' },
                { label: 'Role', width: '13.5rem' },
                { label: 'Status', width: '7.5rem' },
                { label: '', className: 'admin-col-actions', width: '5rem' },
              ],
              rows: users.users.map((user) => ({
                key: user.id,
                cells: [
                  h.div(
                    [h.Class('admin-cell-stack')],
                    [h.strong([], [user.name]), h.small([], [user.email])],
                  ),
                  user.username
                    ? h.a(
                        [h.Href(`/profile/${encodeURIComponent(user.username)}`)],
                        [`@${user.username}`],
                      )
                    : h.span([h.Class('admin-muted')], ['None']),
                  h.form(
                    [...action('set-role'), h.Class('admin-inline-form')],
                    [
                      hidden('userId', user.id),
                      roleSelect(user.role ?? 'user'),
                      h.button([h.Type('submit'), h.AriaLabel('Save role')], ['Save']),
                    ],
                  ),
                  statusBadge(user),
                  menu(user),
                ],
              })),
              empty: query
                ? emptyState(h, 'No users match this search.', { href: '/dashboard/users' })
                : emptyState(h, 'No users found.'),
            }),
        users && users.total > 0
          ? pager(h, {
              label: 'User pages',
              summary: pageRange(offset, users.users.length, users.total),
              previous: offset > 0 ? { href: usersHref(query, Math.max(0, offset - 25)) } : null,
              next:
                offset + users.users.length < users.total
                  ? { href: usersHref(query, offset + 25) }
                  : null,
            })
          : h.empty,
      ]),
    ],
  )
}
