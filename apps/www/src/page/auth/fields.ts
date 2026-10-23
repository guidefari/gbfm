import type { Html, HtmlBuilder } from 'foldkit/html'

import { Message } from '../../message'
import type { Model } from '../../model'

type Builder = HtmlBuilder<Message>

export type PasswordReveal = Pick<Model, 'passwordVisible' | 'interactive'>

export const hiddenField = (h: Builder, name: string, value: string): Html =>
  h.input([h.Type('hidden'), h.Name(name), h.Value(value)])

export const nameField = (h: Builder, value: string): Html =>
  h.label(
    [h.Class('auth-field')],
    [
      h.span([h.Class('auth-label')], ['Name']),
      h.input([
        h.Name('name'),
        h.Required(true),
        h.Autocomplete('name'),
        h.Attribute('value', value),
      ]),
    ],
  )

export const emailField = (h: Builder, value: string): Html =>
  h.label(
    [h.Class('auth-field')],
    [
      h.span([h.Class('auth-label')], ['Email']),
      h.input([
        h.Type('email'),
        h.Name('email'),
        h.Required(true),
        h.Autocomplete('email'),
        h.Attribute('value', value),
      ]),
    ],
  )

const revealToggle = (h: Builder, { passwordVisible, interactive }: PasswordReveal): Html =>
  interactive
    ? h.button(
        [
          h.Type('button'),
          h.Class('auth-reveal'),
          h.AriaControls('auth-password'),
          h.AriaLabel(passwordVisible ? 'Hide password' : 'Show password'),
          h.OnClick(Message.PasswordVisibilityToggled()),
        ],
        [passwordVisible ? 'Hide' : 'Show'],
      )
    : h.empty

export const passwordField = (h: Builder, kind: 'current' | 'new', reveal: PasswordReveal): Html =>
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
      h.div(
        [h.Class('auth-password-wrap')],
        [
          h.input(
            kind === 'current'
              ? [
                  h.Id('auth-password'),
                  h.Autocapitalize('off'),
                  h.Spellcheck(false),
                  h.Type(reveal.passwordVisible ? 'text' : 'password'),
                  h.Name('password'),
                  h.Required(true),
                  h.Autocomplete('current-password'),
                ]
              : [
                  h.Id('auth-password'),
                  h.Autocapitalize('off'),
                  h.Spellcheck(false),
                  h.Type(reveal.passwordVisible ? 'text' : 'password'),
                  h.Name('password'),
                  h.Required(true),
                  h.Autocomplete('new-password'),
                  h.Minlength(8),
                  h.Maxlength(128),
                  h.AriaDescribedBy('auth-password-hint'),
                ],
          ),
          revealToggle(h, reveal),
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
