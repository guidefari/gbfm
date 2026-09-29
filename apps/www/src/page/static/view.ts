import type { RichContentDocument } from '@gbfm/rich-content/schema'
import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../message'
import { richContentView } from '../../rich-content/render'
import { staticPages } from './pages'

export const view = (
  h: HtmlBuilder<Message>,
  page: string,
  title: string,
  changelog: RichContentDocument | null,
) =>
  h.article(
    [h.Class('page prose')],
    [
      h.h1([], [title]),
      ...(staticPages.get(page)?.paragraphs ?? []).map((text) =>
        h.p([h.Class('content-paragraph')], [text]),
      ),
      page === 'changelog' && changelog ? richContentView(changelog, h) : h.empty,
    ],
  )
