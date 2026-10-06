import { type Html, inertHtml as h } from 'foldkit/html'

import { iconPaths, lucide } from './icons'

export type Crumb = Readonly<{ label: string; href: string }>

const separator = () => lucide(iconPaths.chevronRight, 'h-3.5 w-3.5 shrink-0 text-muted-foreground')

export const crumbLink = (crumb: Crumb) =>
  h.a(
    [
      h.Href(crumb.href),
      h.Class('text-muted-foreground no-underline transition-colors hover:text-foreground'),
    ],
    [crumb.label],
  )

export const crumbCurrent = (label: string) =>
  h.span([h.AriaCurrent('page'), h.Class('truncate text-foreground')], [label])

export const breadcrumbs = (crumbs: ReadonlyArray<Html>) =>
  h.nav(
    [h.AriaLabel('Breadcrumb'), h.Class('min-w-0')],
    [
      h.ol(
        [h.Class('m-0 flex min-w-0 list-none items-center gap-1.5 p-0 text-sm')],
        crumbs.map((crumb, index) =>
          h.li(
            [
              h.Key(String(index)),
              h.Class(
                `m-0 flex list-none items-center gap-1.5 ${index === crumbs.length - 1 ? 'min-w-0' : 'shrink-0'}`,
              ),
            ],
            [index > 0 ? separator() : h.empty, crumb],
          ),
        ),
      ),
    ],
  )
