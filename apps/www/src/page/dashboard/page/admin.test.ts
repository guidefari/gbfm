import { describe, expect, it } from 'vitest'

import { highlightRows } from './admin'

describe('admin overview', () => {
  it('labels every highlight for people and formats the counts', () => {
    const rows = highlightRows({
      totalUsers: 1204,
      verifiedUsers: 980,
      newsletterSubscribers: 12,
      totalPlayCount: 54321,
      publishedMixes: 88,
      newUsersLast7Days: 3,
      newSubscribersLast30Days: 0,
      newMixesLast30Days: 4,
    })

    expect(rows.map((row) => `${row.title}: ${row.detail}`)).toEqual([
      'Users: 1,204',
      'Verified users: 980',
      'Subscribers: 12',
      'Total plays: 54,321',
      'Published mixes: 88',
      'New users (7 days): 3',
      'New subscribers (30 days): 0',
      'New mixes (30 days): 4',
    ])
  })
})
