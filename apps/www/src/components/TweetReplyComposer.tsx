import { Button, Textarea, useToast } from '@gbfm/ui'
import { Link } from '@tanstack/react-router'
import { useSession } from '@/lib/auth-client'
import { useCreateMicroPostReply } from '@/lib/http'
import { useTweetReplyComposer, useTweetReplyComposerActions } from '@/store/tweetReplyComposer'

type Props = {
  parentSlug: string
}

export function TweetReplyComposer({ parentSlug }: Props) {
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)
  const { isOpen, draft } = useTweetReplyComposer()
  const { open, setDraft, reset } = useTweetReplyComposerActions()
  const { toast } = useToast()
  const createReply = useCreateMicroPostReply(parentSlug)

  if (!isAuthenticated) {
    return (
      <p className='text-sm text-muted-foreground'>
        <Link to='/auth/sign-in' className='underline'>
          Sign in
        </Link>{' '}
        to reply
      </p>
    )
  }

  if (!isOpen) {
    return (
      <Button type='button' variant='outline' size='sm' className='rounded-sm' onClick={open}>
        Reply
      </Button>
    )
  }

  const handleSubmit = async () => {
    const content = draft.trim()
    if (!content) return

    try {
      await createReply.mutateAsync(content)
      reset()
      toast({ title: 'Reply posted' })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to post reply',
        description: 'Please try again later.'
      })
    }
  }

  return (
    <div className='space-y-2 rounded-lg border border-border/60 bg-card/60 p-3'>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder='Write a reply…'
        className='h-20'
        autoFocus
      />
      <div className='flex justify-end gap-2'>
        <Button type='button' variant='ghost' size='sm' onClick={reset}>
          Cancel
        </Button>
        <Button
          type='button'
          size='sm'
          disabled={createReply.isPending || !draft.trim()}
          onClick={handleSubmit}>
          {createReply.isPending ? 'Posting…' : 'Post reply'}
        </Button>
      </div>
    </div>
  )
}
