import { Match } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from './message'

const link = (h: HtmlBuilder<Message>, href: string, label: string) => h.a([h.Href(href)], [label])

export const authView = (h: HtmlBuilder<Message>, action: string, url: URL) =>
  action === 'verify-email'
    ? h.section(
        [h.Class('page narrow')],
        [
          h.h1([], ['Check your email']),
          h.p([], ['Use the verification link in your inbox to verify your account.']),
          link(h, '/auth/sign-in', 'Sign in'),
        ],
      )
    : h.section(
        [h.Class('auth-page')],
        [
          h.form(
            [h.Class('panel'), h.Method('post'), h.Action(`/auth/${action}`)],
            [
              url.searchParams.has('sent')
                ? h.p([h.Role('status')], ['Check your inbox for a password reset link.'])
                : h.empty,
              url.searchParams.has('reset')
                ? h.p(
                    [h.Role('status')],
                    ['Your password has been reset. Sign in with your new password.'],
                  )
                : h.empty,
              h.input([
                h.Type('hidden'),
                h.Name('token'),
                h.Value(url.searchParams.get('token') ?? ''),
              ]),
              h.input([
                h.Type('hidden'),
                h.Name('returnTo'),
                h.Value(url.searchParams.get('returnTo') ?? '/dashboard'),
              ]),
              h.h1(
                [],
                [
                  Match.value(action).pipe(
                    Match.when('sign-up', () => 'Create your account'),
                    Match.when('sign-in', () => 'Welcome back'),
                    Match.orElse(() => 'Reset your password'),
                  ),
                ],
              ),
              action === 'sign-up'
                ? h.label(
                    [],
                    ['Name', h.input([h.Name('name'), h.Required(true), h.Autocomplete('name')])],
                  )
                : h.empty,
              action === 'reset-password'
                ? h.empty
                : h.label(
                    [],
                    [
                      'Email',
                      h.input([
                        h.Type('email'),
                        h.Name('email'),
                        h.Required(true),
                        h.Autocomplete('email'),
                      ]),
                    ],
                  ),
              action !== 'forgot-password'
                ? h.label(
                    [],
                    [
                      'Password',
                      h.input([
                        h.Type('password'),
                        h.Name('password'),
                        h.Required(true),
                        h.Autocomplete(action === 'sign-in' ? 'current-password' : 'new-password'),
                      ]),
                    ],
                  )
                : h.empty,
              h.button(
                [h.Type('submit')],
                [
                  Match.value(action).pipe(
                    Match.when('sign-up', () => 'Sign up'),
                    Match.when('sign-in', () => 'Sign in'),
                    Match.orElse(() => 'Continue'),
                  ),
                ],
              ),
              link(
                h,
                action === 'sign-in' ? '/auth/sign-up' : '/auth/sign-in',
                action === 'sign-in' ? 'Create an account' : 'Sign in',
              ),
              action === 'sign-in' ? link(h, '/auth/forgot-password', 'Forgot password?') : h.empty,
            ],
          ),
        ],
      )
