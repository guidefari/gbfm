import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../message'
import { authErrorMessages } from './errors'
import { link, noticePanel } from './shell'

type Builder = HtmlBuilder<Message>

export const verifyEmail = (h: Builder): Html =>
  noticePanel(h, {
    title: 'Check your email',
    subtitle: 'Use the verification link in your inbox to verify your account.',
    body: h.empty,
    footer: ['Verified? ', link(h, '/auth/sign-in', 'Sign in')],
  })

export const invalidResetLink = (h: Builder): Html =>
  noticePanel(h, {
    title: 'Reset your password',
    subtitle: 'This link can no longer be used.',
    body: h.p([h.Role('alert'), h.Class('auth-status auth-error')], [authErrorMessages.token]),
    footer: [link(h, '/auth/forgot-password', 'Request a new link')],
  })
