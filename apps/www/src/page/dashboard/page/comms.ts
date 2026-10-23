import type { HtmlBuilder } from 'foldkit/html'

import { Message } from '../message'
import type { Model } from '../model'
import {
  absoluteTime,
  activeDatePreset,
  badge,
  dataTable,
  datePresets,
  daysAgoDate,
  emptyState,
  filterHref,
  frame,
  pageHeader,
  pageRange,
  pager,
  relativeTime,
  segmented,
  type Tone,
} from '../ui'

const date = (value: string) =>
  new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  }).format(new Date(value))

export const subscribersView = (model: Model, h: HtmlBuilder<Message>) => {
  const subscribers = model.subscribers ?? []
  const search = (model.fields.subscriberSearch ?? '').trim().toLowerCase()
  const status = model.fields.subscriberStatus ?? 'all'
  const active = subscribers.filter((item) => !item.unsubscribedAt).length

  const filtered = subscribers.filter(
    (item) =>
      `${item.email} ${item.name ?? ''}`.toLowerCase().includes(search) &&
      (status === 'all' ||
        (status === 'subscribed' ? !item.unsubscribedAt : Boolean(item.unsubscribedAt))),
  )

  return h.div(
    [h.Class('comms-stack')],
    [
      h.p(
        [h.Class('comms-intro')],
        [
          'The people who signed up to hear from goosebumps.fm. Subscription status is separate from individual email preferences.',
        ],
      ),
      h.div(
        [h.Class('comms-stats')],
        [
          h.div(
            [],
            [h.strong([], [String(subscribers.length)]), h.span([], ['Total subscribers'])],
          ),
          h.div([], [h.strong([], [String(active)]), h.span([], ['Subscribed'])]),
          h.div(
            [],
            [h.strong([], [String(subscribers.length - active)]), h.span([], ['Unsubscribed'])],
          ),
        ],
      ),
      h.section(
        [h.Class('dashboard-panel comms-stack')],
        [
          h.div(
            [h.Class('comms-filters dashboard-form')],
            [
              h.label(
                [],
                [
                  'Search subscribers',
                  h.input([
                    h.Type('search'),
                    h.Value(model.fields.subscriberSearch ?? ''),
                    h.OnInput((value) => Message.FieldChanged({ name: 'subscriberSearch', value })),
                  ]),
                ],
              ),
              h.label(
                [],
                [
                  'Subscription status',
                  h.select(
                    [
                      h.Value(status),
                      h.OnChange((value) =>
                        Message.FieldChanged({ name: 'subscriberStatus', value }),
                      ),
                    ],
                    [
                      h.option([h.Value('all')], ['All statuses']),
                      h.option([h.Value('subscribed')], ['Subscribed']),
                      h.option([h.Value('unsubscribed')], ['Unsubscribed']),
                    ],
                  ),
                ],
              ),
            ],
          ),
          h.p([h.Role('status')], [`${filtered.length} of ${subscribers.length} subscribers`]),
          filtered.length === 0
            ? h.p(
                [h.Class('dashboard-empty')],
                [
                  subscribers.length
                    ? 'No subscribers match these filters.'
                    : 'No newsletter subscribers yet. New signups will appear here.',
                ],
              )
            : h.ul(
                [h.Class('dashboard-list comms-list')],
                filtered.map((item) =>
                  h.li(
                    [h.Key(item.id)],
                    [
                      h.div(
                        [],
                        [
                          h.strong([], [item.email]),
                          h.small([], [item.name || 'No name provided']),
                          h.small(
                            [],
                            [`${item.source || 'Unknown source'} · Joined ${date(item.createdAt)}`],
                          ),
                        ],
                      ),
                      h.span(
                        [h.Class(`comms-badge ${item.unsubscribedAt ? '' : 'comms-badge-active'}`)],
                        [item.unsubscribedAt ? 'Unsubscribed' : 'Subscribed'],
                      ),
                    ],
                  ),
                ),
              ),
        ],
      ),
    ],
  )
}

type EmailLog = NonNullable<Model['emailLogs']>['data'][number]

const statusLabel = (status: string) =>
  status === 'SENT' ? 'Accepted' : status.charAt(0) + status.slice(1).toLowerCase()

const statusTones: Record<EmailLog['status'], Tone> = {
  PENDING: 'neutral',
  SENT: 'ok',
  DELIVERED: 'ok',
  BOUNCED: 'error',
  COMPLAINED: 'error',
  FAILED: 'error',
}

const statusFilters = ['', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED']

const historyPath = '/dashboard/email-logs'

const logDetail = (h: HtmlBuilder<Message>, item: EmailLog) => {
  const entries: ReadonlyArray<readonly [string, string | null]> = [
    ['Recipient', item.recipientName ? `${item.recipientName} <${item.recipientEmail}>` : null],
    ['Provider', item.provider],
    ['Provider message ID', item.providerMessageId],
    ['Failure', item.failureCategory],
    ['Error', item.errorMessage],
    ['Created', absoluteTime(item.createdAt)],
    ['Sent', item.sentAt && absoluteTime(item.sentAt)],
    ['Delivered', item.deliveredAt && absoluteTime(item.deliveredAt)],
    ['Bounced', item.bouncedAt && absoluteTime(item.bouncedAt)],
    ['Complained', item.complainedAt && absoluteTime(item.complainedAt)],
  ]

  return h.dl(
    [h.Class('admin-detail')],
    entries.flatMap(([label, value]) => (value ? [h.dt([], [label]), h.dd([], [value])] : [])),
  )
}

export const historyView = (model: Model, url: string, h: HtmlBuilder<Message>) => {
  const query = new URL(url).searchParams
  const now = Date.now()
  const logs = model.emailLogs
  const page = logs?.pagination
  const loading = model.phase === 'loading'
  const status = query.get('status') ?? ''
  const recipient = query.get('recipientEmail') ?? ''
  const dateFrom = query.get('dateFrom') ?? ''
  const dateTo = query.get('dateTo') ?? ''
  const preset = activeDatePreset(dateFrom, dateTo, now)
  const filtered = Boolean(status || recipient || dateFrom || dateTo)

  const href = (changes: Readonly<Record<string, string | null>>) =>
    filterHref(historyPath, query, changes)

  const pageHref = (offset: number) => {
    const params = new URLSearchParams(query)
    params.set('offset', String(offset))

    return `${historyPath}?${params}`
  }

  const statuses = statusFilters.includes(status) ? statusFilters : [...statusFilters, status]

  return h.div(
    [h.Class('admin-page')],
    [
      pageHeader(
        h,
        'Every delivery attempt, including account emails and mix announcements. Accepted means the provider took the email, not that it reached an inbox.',
      ),
      frame(h, [
        h.form(
          [h.Method('get'), h.Action(historyPath), h.Class('admin-toolbar'), h.Role('search')],
          [
            segmented(
              h,
              'Delivery status',
              statuses.map((value) => ({
                label: value ? statusLabel(value) : 'All',
                active: value === status,
                href: href({ status: value || null }),
              })),
            ),
            h.input([
              h.Type('search'),
              h.Name('recipientEmail'),
              h.AriaLabel('Recipient email'),
              h.Placeholder('Search recipient'),
              h.Attribute('value', recipient),
            ]),
            ...['status', 'dateFrom', 'dateTo'].flatMap((name) => {
              const value = query.get(name)

              return value
                ? [h.input([h.Type('hidden'), h.Name(name), h.Attribute('value', value)])]
                : []
            }),
            h.button([h.Type('submit')], ['Search']),
            segmented(
              h,
              'Date range',
              datePresets.map((option) => ({
                label: option.label,
                active: option.days === preset,
                href: href({
                  dateFrom: option.days === null ? null : daysAgoDate(option.days, now),
                  dateTo: null,
                }),
              })),
            ),
            preset === 'custom'
              ? h.span(
                  [h.Class('admin-toolbar-range')],
                  [
                    badge(h, `${dateFrom || 'Start'} to ${dateTo || 'today'}`, 'neutral'),
                    h.a([h.Href(href({ dateFrom: null, dateTo: null }))], ['Clear dates']),
                  ],
                )
              : h.empty,
            filtered
              ? h.a([h.Href(historyPath), h.Class('admin-toolbar-end')], ['Clear'])
              : h.empty,
          ],
        ),
        dataTable(h, {
          label: 'Delivery history',
          loading,
          minWidth: '56rem',
          columns: [
            { label: 'Status', width: '7rem' },
            { label: 'Subject' },
            { label: 'Recipient', width: '30%' },
            { label: 'Template', className: 'admin-col-mono', width: '11rem' },
            { label: 'Sent', className: 'admin-col-muted', width: '7.5rem' },
          ],
          rows: (logs?.data ?? []).map((item) => {
            const open = model.fields.openLog === item.id

            return {
              key: item.id,
              cells: [
                h.span(
                  [],
                  [
                    badge(h, statusLabel(item.status), statusTones[item.status]),
                    item.failureCategory ? badge(h, item.failureCategory, 'error') : h.empty,
                  ],
                ),
                h.button(
                  [
                    h.Type('button'),
                    h.Class('admin-disclosure'),
                    h.AriaExpanded(open),
                    h.Title(item.subject),
                    h.OnClick(
                      Message.FieldChanged({ name: 'openLog', value: open ? '' : item.id }),
                    ),
                  ],
                  [item.subject],
                ),
                h.span(item.recipientName ? [h.Title(item.recipientName)] : [], [
                  item.recipientEmail,
                ]),
                item.templateName,
                relativeTime(h, item.createdAt, now),
              ],
              detail: open ? logDetail(h, item) : null,
            }
          }),
          empty: filtered
            ? emptyState(h, 'No emails match these filters.', { href: historyPath })
            : emptyState(h, 'No emails sent yet.'),
        }),
        page && page.total > 0
          ? pager(h, {
              label: 'Delivery history pages',
              summary: pageRange(page.offset, logs.data.length, page.total),
              previous:
                page.offset > 0 ? { href: pageHref(Math.max(0, page.offset - page.limit)) } : null,
              next: page.hasMore ? { href: pageHref(page.offset + page.limit) } : null,
            })
          : h.empty,
      ]),
    ],
  )
}
