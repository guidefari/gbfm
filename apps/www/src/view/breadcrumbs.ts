import { Nav } from '@foldkit/ui'
import { Array } from 'effect'
import { inertHtml as h } from 'foldkit/html'

import { iconPaths, lucide } from './icons'

export type Crumb = Readonly<{ label: string; href: string }>

export const breadcrumbs = (crumbs: ReadonlyArray<Crumb>) =>
  Nav.view({
    items: crumbs.map((crumb) => crumb.href),
    ariaLabel: 'Breadcrumb',
    toHref: (href) => href,
    isItemCurrent: (_, index) => index === crumbs.length - 1,
    toView: ({ nav, items }) =>
      h.nav(
        [...nav, h.Class('min-w-0')],
        [
          h.ol(
            [h.Class('m-0 flex min-w-0 list-none items-center gap-1.5 p-0 text-sm')],
            Array.zip(crumbs, items).map(([crumb, item]) =>
              h.li(
                [
                  h.Key(crumb.href),
                  h.Class(
                    `m-0 flex list-none items-center gap-1.5 ${item.isCurrent ? 'min-w-0' : 'shrink-0'}`,
                  ),
                ],
                [
                  item.index > 0
                    ? lucide(iconPaths.chevronRight, 'h-3.5 w-3.5 shrink-0 text-muted-foreground')
                    : h.empty,
                  h.a(
                    [
                      ...item.link,
                      h.Class(
                        item.isCurrent
                          ? 'truncate text-foreground no-underline'
                          : 'shrink-0 text-muted-foreground no-underline transition-colors hover:text-foreground',
                      ),
                    ],
                    [crumb.label],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
  })
