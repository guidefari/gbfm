<script lang="ts">
  import { enhance } from '$app/forms'

  let {
    slug,
    signedIn,
    feedback,
  }: {
    slug: string
    signedIn: boolean
    feedback: { readonly content: string; readonly message: string } | undefined
  } = $props()

  let open = $state(false)

  let posting = $state(false)

  let draft = $state('')
</script>

{#if !signedIn}
  <p class="text-base text-muted-foreground">
    <a href={`/auth/sign-in?redirect=${encodeURIComponent(`/tweet/${slug}`)}`} class="underline"
      >Sign in</a
    > to reply
  </p>
{:else if !open}
  <button
    type="button"
    class="min-h-9 rounded-sm border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
    onclick={() => {
      draft = feedback?.content ?? ''
      open = true
    }}>Reply</button
  >
{:else}
  <form
    method="POST"
    action="?/reply"
    class="space-y-2 rounded-lg border border-border/60 bg-card/60 p-3"
    use:enhance={() => {
      posting = true
      return async ({ result, update }) => {
        posting = false
        if (result.type === 'success') {
          draft = ''
          open = false
        }
        await update({ reset: false })
      }
    }}
  >
    <label class="sr-only" for="reply">Write a reply</label>
    <textarea
      id="reply"
      name="content"
      bind:value={draft}
      class="h-20 w-full rounded-sm border border-border bg-background p-3 text-base"
      placeholder="Write a reply…"></textarea>
    <div class="flex items-center justify-end gap-2">
      <button
        type="button"
        class="min-h-9 px-3 text-sm text-muted-foreground"
        onclick={() => (open = false)}>Cancel</button
      >
      <button
        disabled={posting || !draft.trim()}
        class="min-h-9 bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >{posting ? 'Posting…' : 'Post reply'}</button
      >
    </div>
  </form>
{/if}
{#if feedback?.message}<p role="status" class="text-sm text-muted-foreground">
    {feedback.message}
  </p>{/if}
