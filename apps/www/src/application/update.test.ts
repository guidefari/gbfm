import { describe, expect, it } from 'vitest'

import { Message as CreatorMessage } from '../creator/model'
import { Message as DashboardMessage } from '../dashboard/model'
import { init } from './init'
import { Message } from './message'
import type { Flags } from './model'
import { parseRoute, Route } from './route'
import { update } from './update'

describe('parseRoute', () => {
  it('parses public, creator, dashboard, and missing routes', () => {
    expect(parseRoute('/mixes/42')).toEqual(Route.cases.Detail.make({ kind: 'mixes', slug: '42' }))
    expect(parseRoute('/new/editorial')).toEqual(Route.cases.Composer.make({ kind: 'editorial' }))
    expect(parseRoute('/dashboard/email-logs')).toEqual(
      Route.cases.Dashboard.make({
        section: 'email-logs',
      }),
    )
    expect(parseRoute('/local-creator')).toEqual(
      Route.cases.Detail.make({ kind: 'resolve', slug: 'local-creator' }),
    )
    expect(parseRoute('/definitely/missing/route')).toEqual(Route.cases.NotFound.make({}))
  })

  it('drops creator and dashboard command results from a prior navigation', () => {
    const flags: Flags = {
      url: 'https://gbfm.co.za/new/mix',
      status: 200,
      principal: null,
      items: [],
      title: 'Create',
      description: '',
      requestId: 'test',
      renderedAt: 0,
      skipSeen: false,
      tweet: null,
      neighbours: null,
      dashboard: null,
      profile: null,
      shows: null,
      changelog: null,
      publicAction: null,
      metadata: null,
      failure: null,
    }

    const model = { ...init(flags).model, navigationId: 3 }
    const result = CreatorMessage.AudioUploaded({ url: 'https://cdn.example/previous.mp3' })
    expect(update(model, Message.GotCreatorResult({ message: result, navigationId: 2 }))).toEqual({
      model,
    })
    expect(
      update(model, Message.GotCreatorResult({ message: result, navigationId: 3 })).model.creator
        .draft.audioUrl,
    ).toBe('https://cdn.example/previous.mp3')
    const failure = DashboardMessage.Failed({ message: 'Failure for the old account screen' })
    expect(
      update(model, Message.GotDashboardResult({ message: failure, navigationId: 2 })),
    ).toEqual({ model })
    expect(
      update(model, Message.GotDashboardResult({ message: failure, navigationId: 3 })).model
        .dashboard.error,
    ).toBe('Failure for the old account screen')
  })
})
