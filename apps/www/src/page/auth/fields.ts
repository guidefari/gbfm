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

export const passwordField = (h: Builder, autocomplete: string, showForgotLink: boolean): Html =>
  h.div(
    [h.Class('auth-field')],
    [
      h.div(
        [h.Class('auth-label-row')],
        [
          h.label([h.Class('auth-label'), h.For('auth-password')], ['Password']),
          showForgotLink
            ? h.a(
                [h.Href('/auth/forgot-password'), h.Class('auth-subtle-link')],
                ['Forgot password?'],
              )
            : h.empty,
        ],
      ),
      h.input([
        h.Id('auth-password'),
        h.Type('password'),
        h.Name('password'),
        h.Required(true),
        h.Autocomplete(autocomplete),
      ]),
    ],
  )

export const statusMessage = (h: Builder, text: string): Html =>
  h.p([h.Role('status'), h.Class('auth-status')], [text])
