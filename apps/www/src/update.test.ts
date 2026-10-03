import { describe, expect, it } from 'vitest'

import { init } from './init'
import { Message } from './message'
import type { Flags } from './model'
import { Message as CreatorMessage } from './page/creator/message'
import { Message as DashboardMessage } from './page/dashboard/message'
import { parseRoute, Route } from './route'
import { update } from './update'

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

describe('mobile menu pull gesture', () => {
  const openMenu = () => {
    const model = init(flags).model

    return { ...model, mobileMenu: { ...model.mobileMenu, isOpen: true } }
  }

  it('follows the active pointer downward and snaps short pulls back', () => {
    const started = update(
      openMenu(),
      Message.MenuDragStarted({ pointerId: 1, clientY: 100 }),
    ).model

    const moved = update(started, Message.MenuDragMoved({ pointerId: 1, clientY: 180 })).model
    expect(moved.menuOffset).toBe(80)
    expect(update(moved, Message.MenuDragMoved({ pointerId: 2, clientY: 400 })).model).toBe(moved)

    const released = update(
      moved,
      Message.MenuDragReleased({ pointerId: 1, clientY: 180, viewportHeight: 800 }),
    ).model

    expect(released.menuDrag).toBeNull()
    expect(released.menuOffset).toBe(0)
    expect(released.mobileMenu.isOpen).toBe(true)
  })

  it('closes past the threshold while keeping the release offset for the exit animation', () => {
    const started = update(
      openMenu(),
      Message.MenuDragStarted({ pointerId: 1, clientY: 100 }),
    ).model

    const released = update(
      started,
      Message.MenuDragReleased({ pointerId: 1, clientY: 270, viewportHeight: 800 }),
    ).model

    expect(released.mobileMenu.isOpen).toBe(false)
    expect(released.menuOffset).toBe(170)
    expect(released.menuDrag).toBeNull()
  })

  it('ignores drags while the menu is closed', () => {
    const closed = init(flags).model
    expect(update(closed, Message.MenuDragStarted({ pointerId: 1, clientY: 100 })).model).toBe(
      closed,
    )
  })
})
