import { ROLES } from '@gbfm/core/roles'
import { Schema } from 'effect'
import { inertHtml as h } from 'foldkit/html'

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

const hidden = (name: string, value: string) =>
  h.input([h.Type('hidden'), h.Name(name), h.Value(value)])

const field = (label: string, name: string, type = 'text') =>
  h.label([], [label, h.input([h.Name(name), h.Type(type)])])

const roleSelect = (selected: string) =>
  h.select(
    [h.Name('role'), h.AriaLabel('Role')],
    ROLES.map((role) => h.option([h.Value(role), h.Selected(role === selected)], [role])),
  )

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

  return h.section(
    [h.Class('dashboard-panel dashboard-form')],
    [
      h.h2([], ['User accounts']),
      notice
        ? h.p(
            [h.Role(notice === 'failed' ? 'alert' : 'status')],
            [
              notice === 'failed'
                ? 'The account action failed. Your access or the submitted values may have changed.'
                : 'Account action completed.',
            ],
          )
        : h.empty,
      h.form(
        [h.Method('get'), h.Action('/dashboard/users')],
        [
          h.label(
            [],
            ['Search by email', h.input([h.Type('search'), h.Name('search'), h.Value(query)])],
          ),
          h.button([h.Type('submit')], ['Search users']),
        ],
      ),
      h.details(
        [],
        [
          h.summary([], ['Create user']),
          h.form(
            [...action('create-user'), h.Class('dashboard-form')],
            [
              field('Display name', 'name'),
              field('Username', 'username'),
              field('Email', 'email', 'email'),
              field('Password (optional)', 'password', 'password'),
              h.label([], ['Role', roleSelect('user')]),
              h.p(
                [],
                [
                  'Provide an email or username. A blank password is generated securely; use Invite to send access instructions.',
                ],
              ),
              h.button([h.Type('submit')], ['Create account']),
            ],
          ),
        ],
      ),
      !users
        ? h.p([h.Role('alert')], ['Could not load user accounts.'])
        : h.div(
            [],
            [
              h.p([], [`${users.total} users`]),
              h.ul(
                [h.Class('dashboard-list admin-users')],
                users.users.map((user) =>
                  h.li(
                    [h.Key(user.id)],
                    [
                      h.div(
                        [],
                        [
                          h.strong([], [user.name]),
                          h.small([], [user.email]),
                          user.username
                            ? h.a(
                                [h.Href(`/profile/${encodeURIComponent(user.username)}`)],
                                [`@${user.username}`],
                              )
                            : h.empty,
                          h.p(
                            [],
                            [
                              user.banned
                                ? `Banned${user.banReason ? `: ${user.banReason}` : ''}`
                                : user.emailVerified === false
                                  ? 'Unverified'
                                  : 'Active',
                            ],
                          ),
                          h.form(
                            [...action('set-role'), h.Class('creator-actions')],
                            [
                              hidden('userId', user.id),
                              roleSelect(user.role ?? 'user'),
                              h.button([h.Type('submit')], ['Save role']),
                            ],
                          ),
                          h.div(
                            [h.Class('creator-actions')],
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
                                  h.form(action('remove-user'), [
                                    hidden('userId', user.id),
                                    h.p(
                                      [],
                                      [`Permanently delete ${user.name}? This cannot be undone.`],
                                    ),
                                    h.button([h.Type('submit')], ['Confirm delete']),
                                  ]),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              users.users.length === 0 ? h.p([], ['No users found.']) : h.empty,
              h.nav(
                [h.AriaLabel('User pages'), h.Class('user-pagination')],
                [
                  offset > 0
                    ? h.a(
                        [
                          h.Href(
                            `/dashboard/users?${new URLSearchParams({ search: query, offset: String(Math.max(0, offset - 25)) })}`,
                          ),
                        ],
                        ['Previous users'],
                      )
                    : h.empty,
                  h.span(
                    [],
                    [
                      `${users.total === 0 ? 0 : offset + 1}–${Math.min(users.total, offset + users.users.length)} of ${users.total}`,
                    ],
                  ),
                  offset + users.users.length < users.total
                    ? h.a(
                        [
                          h.Href(
                            `/dashboard/users?${new URLSearchParams({ search: query, offset: String(offset + 25) })}`,
                          ),
                        ],
                        ['Next users'],
                      )
                    : h.empty,
                ],
              ),
            ],
          ),
    ],
  )
}
