import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../message'

type Builder = HtmlBuilder<Message>

export const hiddenField = (h: Builder, name: string, value: string): Html =>
  h.input([h.Type('hidden'), h.Name(name), h.Value(value)])

export const nameField = (h: Builder): Html =>
  h.label([], ['Name', h.input([h.Name('name'), h.Required(true), h.Autocomplete('name')])])

export const emailField = (h: Builder): Html =>
  h.label(
    [],
    [
      'Email',
      h.input([h.Type('email'), h.Name('email'), h.Required(true), h.Autocomplete('email')]),
    ],
  )

export const passwordField = (h: Builder, autocomplete: string): Html =>
  h.label(
    [],
    [
      'Password',
      h.input([
        h.Type('password'),
        h.Name('password'),
        h.Required(true),
        h.Autocomplete(autocomplete),
      ]),
    ],
  )

export const statusMessage = (h: Builder, text: string): Html => h.p([h.Role('status')], [text])
