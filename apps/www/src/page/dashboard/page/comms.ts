import type { HtmlBuilder } from 'foldkit/html'

import { Message } from '../message'
import type { Model } from '../model'

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

const statusLabel = (status: string) =>
  status === 'SENT' ? 'Accepted' : status.charAt(0) + status.slice(1).toLowerCase()

export const historyView = (model: Model, url: string, h: HtmlBuilder<Message>) => {
  const query = new URL(url).searchParams
  const logs = model.emailLogs
  const page = logs?.pagination

  const link = (offset: number) => {
    const params = new URLSearchParams(query)
    params.set('offset', String(offset))

    return `/dashboard/email-logs?${params}`
  }

  const field = (name: string, label: string, type: string) =>
    h.label(
      [],
      [
        label,
        h.input([
          h.Name(name),
          h.Type(type),
          h.Value(model.fields[name] ?? query.get(name) ?? ''),
          h.OnInput((value) => Message.FieldChanged({ name, value })),
        ]),
      ],
    )

  return h.div(
    [h.Class('comms-stack')],
    [
      h.p(
        [h.Class('comms-intro')],
        [
          'Individual delivery attempts, including account emails and mix announcements. Accepted means the provider took the email—not that it reached an inbox.',
        ],
      ),
      h.form(
        [
          h.Method('get'),
          h.Action('/dashboard/email-logs'),
          h.Class('dashboard-panel comms-history-filters dashboard-form'),
        ],
        [
          field('recipientEmail', 'Recipient email', 'search'),
          h.label(
            [],
            [
              'Delivery status',
              h.select(
                [
                  h.Name('status'),
                  h.Value(model.fields.status ?? query.get('status') ?? ''),
                  h.OnChange((value) => Message.FieldChanged({ name: 'status', value })),
                ],
                [
                  h.option([h.Value('')], ['All statuses']),
                  ...['PENDING', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED'].map(
                    (status) => h.option([h.Value(status)], [statusLabel(status)]),
                  ),
                ],
              ),
            ],
          ),
          field('dateFrom', 'From date (UTC)', 'date'),
          field('dateTo', 'To date (UTC)', 'date'),
          h.div(
            [h.Class('comms-actions')],
            [
              h.button([h.Type('submit')], ['Filter history']),
              h.a([h.Href('/dashboard/email-logs')], ['Clear filters']),
            ],
          ),
        ],
      ),
      h.section(
        [h.Class('dashboard-panel comms-stack')],
        [
          h.h2([], ['Delivery history']),
          h.p(
            [h.Role('status')],
            [
              page
                ? `${page.total} matching delivery attempt(s)`
                : 'No delivery history available.',
            ],
          ),
          !logs?.data.length
            ? h.p([h.Class('dashboard-empty')], ['No emails match these filters.'])
            : h.ul(
                [h.Class('dashboard-list comms-list')],
                logs.data.map((item) =>
                  h.li(
                    [h.Key(item.id)],
                    [
                      h.div(
                        [],
                        [
                          h.strong([], [item.subject]),
                          h.small([], [item.recipientEmail]),
                          h.small([], [`${date(item.createdAt)} · ${item.templateName}`]),
                          item.failureCategory
                            ? h.small([], [`Failure: ${item.failureCategory}`])
                            : h.empty,
                        ],
                      ),
                      h.span(
                        [
                          h.Class(
                            `comms-badge ${item.status === 'SENT' || item.status === 'DELIVERED' ? 'comms-badge-active' : ''}`,
                          ),
                        ],
                        [statusLabel(item.status)],
                      ),
                    ],
                  ),
                ),
              ),
          page
            ? h.nav(
                [h.Class('comms-actions'), h.AriaLabel('Delivery history pages')],
                [
                  page.offset > 0
                    ? h.a([h.Href(link(Math.max(0, page.offset - page.limit)))], ['← Previous'])
                    : h.empty,
                  h.span(
                    [],
                    [
                      page.total
                        ? `${page.offset + 1}–${Math.min(page.offset + page.limit, page.total)} of ${page.total}`
                        : '0 results',
                    ],
                  ),
                  page.hasMore
                    ? h.a([h.Href(link(page.offset + page.limit))], ['Next →'])
                    : h.empty,
                ],
              )
            : h.empty,
        ],
      ),
    ],
  )
}
