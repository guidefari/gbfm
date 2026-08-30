import { describe, expect, test } from 'vitest'
import { replyPresentationOf } from './tweet-reply-presentation'

describe('replyPresentationOf', () => {
  test('a top level post is a root', () => {
    expect(replyPresentationOf({ depth: 0, parentPostId: null })).toEqual({ kind: 'root' })
  })

  test('a post with no depth or parent at all is a root', () => {
    expect(replyPresentationOf({})).toEqual({ kind: 'root' })
  })

  test('a post at depth one with a parent is a reply carrying its parent id', () => {
    expect(replyPresentationOf({ depth: 1, parentPostId: '755edcc0' })).toEqual({
      kind: 'reply',
      parentPostId: '755edcc0'
    })
  })

  test('a nested reply is still a reply', () => {
    expect(replyPresentationOf({ depth: 3, parentPostId: 'abc' })).toEqual({
      kind: 'reply',
      parentPostId: 'abc'
    })
  })

  test('a parent id with depth zero still counts as a reply', () => {
    expect(replyPresentationOf({ depth: 0, parentPostId: 'abc' })).toEqual({
      kind: 'reply',
      parentPostId: 'abc'
    })
  })

  test('depth without a parent id is a reply we cannot link back', () => {
    expect(replyPresentationOf({ depth: 1, parentPostId: null })).toEqual({
      kind: 'reply-without-parent'
    })
  })

  test('a null depth with no parent is a root', () => {
    expect(replyPresentationOf({ depth: null, parentPostId: null })).toEqual({ kind: 'root' })
  })
})
