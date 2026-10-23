import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../message'

type Builder = HtmlBuilder<Message>

export const hiddenField = (h: Builder, name: string, value: string): Html =>
  h.input([h.Type('hidden'), h.Name(name), h.Value(value)])

export const nameField = (h: Builder): Html =>
  h.label(
    [h.Class('auth-field')],
    [
      h.span([h.Class('auth-label')], ['Name']),
      h.input([h.Name('name'), h.Required(true), h.Autocomplete('name')]),
    ],
  )

export const emailField = (h: Builder): Html =>
  h.label(
    [h.Class('auth-field')],
    [
      h.span([h.Class('auth-label')], ['Email']),
      h.input([h.Type('email'), h.Name('email'), h.Required(true), h.Autocomplete('email')]),
    ],
  )

export const passwordField = (h: Builder, kind: 'current' | 'new'): Html =>
  h.div(
    [h.Class('auth-field')],
    [
      h.div(
        [h.Class('auth-label-row')],
        [
          h.label([h.Class('auth-label'), h.For('auth-password')], ['Password']),
          kind === 'current'
            ? h.a(
                [h.Href('/auth/forgot-password'), h.Class('auth-subtle-link')],
                ['Forgot password?'],
              )
            : h.empty,
        ],
      ),
      h.input(
        kind === 'current'
          ? [
              h.Id('auth-password'),
              h.Type('password'),
              h.Name('password'),
              h.Required(true),
              h.Autocomplete('current-password'),
            ]
          : [
              h.Id('auth-password'),
              h.Type('password'),
              h.Name('password'),
              h.Required(true),
              h.Autocomplete('new-password'),
              h.Minlength(8),
              h.Maxlength(128),
              h.AriaDescribedBy('auth-password-hint'),
            ],
      ),
      kind === 'new'
        ? h.p([h.Id('auth-password-hint'), h.Class('auth-hint')], ['At least 8 characters.'])
        : h.empty,
    ],
  )

export const statusMessage = (h: Builder, text: string): Html =>
  h.p([h.Role('status'), h.Class('auth-status')], [text])

export const errorMessage = (h: Builder, text: string): Html =>
  h.p([h.Role('alert'), h.Class('auth-status auth-error')], [text])
