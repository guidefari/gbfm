import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from '../message'

export const link = (h: HtmlBuilder<Message>, href: string, label: string, className = '') =>
  h.a([h.Href(href), h.Class(className)], [label])
