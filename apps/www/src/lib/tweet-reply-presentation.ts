type ReplyPresentationInput = {
  depth?: number | null
  parentPostId?: string | null
}

export type ReplyPresentation =
  | { kind: 'root' }
  | { kind: 'reply'; parentPostId: string }
  | { kind: 'reply-without-parent' }

export function replyPresentationOf(post: ReplyPresentationInput): ReplyPresentation {
  const isReply = (post.depth ?? 0) > 0 || Boolean(post.parentPostId)

  if (!isReply) {
    return { kind: 'root' }
  }

  return post.parentPostId
    ? { kind: 'reply', parentPostId: post.parentPostId }
    : { kind: 'reply-without-parent' }
}
