import type { RichContentDocument } from '@gbfm/rich-content/schema'
import type { HtmlBuilder } from 'foldkit/html'

import { richContentView } from '../../view/rich-content/render'

const heading = <M>(h: HtmlBuilder<M>, className: string) =>
  h.h2([h.Class(className)], ['About the show'])

/** A CSS-only toggle so the clamp works before hydration and survives re-renders without model state. */
export const aboutInline = <M>(h: HtmlBuilder<M>, document: RichContentDocument) =>
  h.section(
    [h.AriaLabel('About the show'), h.Class('mb-6 border-t border-border pt-5 lg:hidden')],
    [
      heading(h, 'mb-3 text-lg font-bold'),
      h.input([h.Type('checkbox'), h.Id('show-about-toggle'), h.Class('peer sr-only')]),
      h.div(
        [
          h.Class(
            'max-h-28 overflow-hidden [mask-image:linear-gradient(to_bottom,black_50%,transparent)] peer-checked:max-h-none peer-checked:[mask-image:none]',
          ),
        ],
        [richContentView(document, h)],
      ),
      h.label(
        [
          h.For('show-about-toggle'),
          h.Class(
            'mt-2 inline-block cursor-pointer rounded-sm text-sm font-semibold text-highlight peer-focus-visible:ring-2 peer-focus-visible:ring-ring [&>span:last-child]:hidden peer-checked:[&>span:first-child]:hidden peer-checked:[&>span:last-child]:inline',
          ),
        ],
        [h.span([], ['Read more']), h.span([], ['Show less'])],
      ),
    ],
  )

export const aboutSidebar = <M>(h: HtmlBuilder<M>, document: RichContentDocument) =>
  h.aside(
    [h.AriaLabel('About the show'), h.Class('hidden border-l border-border pl-8 text-sm lg:block')],
    [heading(h, 'mb-4 text-lg font-bold'), richContentView(document, h)],
  )
