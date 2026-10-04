import type { RichContentDocument } from '@gbfm/rich-content/schema'
import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../message'
import { richContentView } from '../../view/rich-content/render'
import { aboutLinks, staticPages } from './pages'

export const view = (
  h: HtmlBuilder<Message>,
  page: string,
  title: string,
  changelog: RichContentDocument | null,
) =>
  h.article(
    [
      h.Class(
        'page prose prose-headings:text-foreground prose-p:text-foreground/80 prose-li:text-foreground/80 prose-a:text-foreground prose-a:hover:text-highlight prose-strong:text-foreground marker:text-muted-foreground',
      ),
    ],
    [
      h.h1([], [title]),
      ...(staticPages.get(page)?.paragraphs ?? []).map((text) =>
        h.p([h.Class('content-paragraph')], [text]),
      ),
      page === 'changelog' && changelog ? richContentView(changelog, h) : h.empty,
      ...(page === 'about'
        ? aboutLinks.map(({ heading, links }) =>
            h.section(
              [h.Key(heading)],
              [
                h.h2([], [heading]),
                h.ul(
                  [],
                  links.map(([href, label]) => h.li([h.Key(href)], [h.a([h.Href(href)], [label])])),
                ),
              ],
            ),
          )
        : []),
    ],
  )
