<script lang="ts">
  import InlineMarkdown from './InlineMarkdown.svelte'

  let { content }: { content: string } = $props()

  type Block = { type: 'heading' | 'paragraph' | 'quote' | 'list' | 'code'; text: string; level?: number }
  const stripMdx = (value: string) => value
    .replace(/<([A-Z][\w.]*)\b[^>]*\/>/g, '')
    .replace(/<([A-Z][\w.]*)\b[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/\{[^{}]*\}/g, '')

  const blocks = $derived.by(() => {
    const result: Block[] = []
    let code = false
    let buffer: string[] = []
    const flush = () => {
      if (buffer.length) result.push({ type: code ? 'code' : 'paragraph', text: buffer.join(code ? '\n' : ' ') })
      buffer = []
    }
    for (const raw of stripMdx(content).split('\n')) {
      const line = raw.trimEnd()
      if (line.trim().startsWith('```')) { flush(); code = !code; continue }
      if (code) { buffer.push(raw); continue }
      if (!line.trim()) { flush(); continue }
      const heading = /^(#{1,6})\s+(.+)$/.exec(line)
      if (heading) { flush(); result.push({ type: 'heading', text: heading[2], level: heading[1].length }); continue }
      if (line.startsWith('> ')) { flush(); result.push({ type: 'quote', text: line.slice(2) }); continue }
      if (/^[-*+]\s+/.test(line)) { flush(); result.push({ type: 'list', text: line.replace(/^[-*+]\s+/, '') }); continue }
      buffer.push(line)
    }
    flush()
    return result
  })
</script>

<div class="space-y-4 text-base leading-7">
  {#each blocks as block}
    {#if block.type === 'heading'}
      <h2 class="pt-3 text-xl font-black tracking-tight"><InlineMarkdown value={block.text} /></h2>
    {:else if block.type === 'quote'}
      <blockquote class="border-l-4 border-highlight pl-4 italic text-muted-foreground"><InlineMarkdown value={block.text} /></blockquote>
    {:else if block.type === 'list'}
      <div class="ml-5 list-item list-disc"><InlineMarkdown value={block.text} /></div>
    {:else if block.type === 'code'}
      <pre class="overflow-x-auto bg-muted p-4 text-sm"><code>{block.text}</code></pre>
    {:else}
      <p><InlineMarkdown value={block.text} /></p>
    {/if}
  {/each}
</div>
