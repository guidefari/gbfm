import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../message'
import { wordmark } from '../../view/wordmark'

type Builder = HtmlBuilder<Message>

export const link = (h: Builder, href: string, label: string) => h.a([h.Href(href)], [label])

export const authShell = (h: Builder, panel: Html): Html =>
  h.section(
    [h.Class('auth-page')],
    [h.div([h.Class('auth-backdrop'), h.AriaHidden(true)], [wordmark('full')]), panel],
  )

export const noticePanel = (
  h: Builder,
  content: {
    readonly title: string
    readonly subtitle: string
    readonly body: Html
    readonly footer: ReadonlyArray<Html | string>
  },
): Html =>
  authShell(
    h,
    h.div(
      [h.Class('auth-panel')],
      [
        h.header(
          [h.Class('auth-header')],
          [h.h1([], [content.title]), h.p([h.Class('auth-subtitle')], [content.subtitle])],
        ),
        content.body,
        h.p([h.Class('auth-footer')], content.footer),
      ],
    ),
  )
