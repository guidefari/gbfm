import { inertHtml as h } from 'foldkit/html'

import { iconPaths, lucide } from './icons'

export type Crumb = Readonly<{ label: string; href: string }>

const separator = () => lucide(iconPaths.chevronRight, 'h-3.5 w-3.5 shrink-0 text-muted-foreground')

export const breadcrumbs = (ancestors: ReadonlyArray<Crumb>, current: string) =>
  h.nav(
    [h.AriaLabel('Breadcrumb'), h.Class('min-w-0')],
    [
      h.ol(
        [h.Class('m-0 flex min-w-0 list-none items-center gap-1.5 p-0 text-sm')],
        [
          ...ancestors.map((crumb, index) =>
            h.li(
              [h.Key(crumb.href), h.Class('m-0 flex shrink-0 list-none items-center gap-1.5')],
              [
                index > 0 ? separator() : h.empty,
                h.a(
                  [
                    h.Href(crumb.href),
                    h.Class(
                      'text-muted-foreground no-underline transition-colors hover:text-foreground',
                    ),
                  ],
                  [crumb.label],
                ),
              ],
            ),
          ),
          h.li(
            [h.Class('m-0 flex min-w-0 list-none items-center gap-1.5')],
            [
              ancestors.length ? separator() : h.empty,
              h.span([h.AriaCurrent('page'), h.Class('truncate text-foreground')], [current]),
            ],
          ),
        ],
      ),
    ],
  )
