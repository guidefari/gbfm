import { describe, expect, it } from 'vitest'

import { initialModel, Message, update } from './model'

describe('player submodel', () => {
  it('models queue and fullscreen visibility independently', () => {
    const open = update(initialModel, Message.ToggleQueue()).model
    expect(open.queueDialog.isOpen).toBe(true)
    expect(update(open, Message.ToggleFullscreen()).model).toMatchObject({
      queueDialog: { isOpen: true },
      playerDialog: { isOpen: true },
    })
    expect(update(open, Message.CloseQueue()).model.queueDialog.isOpen).toBe(false)
  })

  it('turns transport requests into Effects without performing them in update', () => {
    const result = update(initialModel, Message.SeekTo({ seconds: 42 }))
    expect(result.model).toBe(initialModel)
    expect(result.commands?.map(({ name }) => name)).toEqual(['PlayerSeek'])
  })

  it('converts a drag/drop gesture to one reorder command', () => {
    const dragging = update(initialModel, Message.DragStarted({ index: 2 })).model
    const dropped = update(dragging, Message.DroppedAt({ index: 0 }))
    expect(dropped.model.draggedIndex).toBeNull()
    expect(dropped.commands?.[0]?.args).toEqual({ from: 2, to: 0 })
  })
})
