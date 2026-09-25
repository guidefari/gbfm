<script lang="ts">
  import InlineMarkdown from './InlineMarkdown.svelte'
  import { splitLegacySoundCloud } from './legacy-soundcloud'

  let { content }: { content: string } = $props()

  type TextBlock = {
    type: 'heading' | 'paragraph' | 'quote' | 'list' | 'code'
    text: string
    level?: number
  }

  type Block =
    TextBlock | { type: 'embed'; src: string; title: string; height: number; href: string }

  const stripMdx = (value: string) =>
    value
      .replace(/<([A-Z][\w.]*)\b[^>]*\/>/g, '')
      .replace(/<([A-Z][\w.]*)\b[^>]*>[\s\S]*?<\/\1>/g, '')
      .replace(/\{[^{}]*\}/g, '')

  const blocks = $derived.by(() => {
    const result: Array<Block> = []
    let code = false
    let buffer: Array<string> = []

    const flush = () => {
      if (buffer.length)
        result.push({ type: code ? 'code' : 'paragraph', text: buffer.join(code ? '\n' : ' ') })
      buffer = []
    }

    for (const part of splitLegacySoundCloud(content)) {
      if (part.type === 'embed') {
        flush()
        result.push(part)
        continue
      }

      for (const raw of stripMdx(part.content).split('\n')) {
        const line = raw.trimEnd()

        if (line.trim().startsWith('```')) {
          flush()
          code = !code
          continue
        }

        if (code) {
          buffer.push(raw)
          continue
        }

        if (!line.trim()) {
          flush()
          continue
        }

        const heading = /^(#{1,6})\s+(.+)$/.exec(line)

        if (heading) {
          const [, marker, text] = heading

          if (marker && text) {
            flush()
            result.push({ type: 'heading', text, level: marker.length })
            continue
          }
        }

        if (line.startsWith('> ')) {
          flush()
          result.push({ type: 'quote', text: line.slice(2) })
          continue
        }

        if (/^[-*+]\s+/.test(line)) {
          flush()
          result.push({ type: 'list', text: line.replace(/^[-*+]\s+/, '') })
          continue
        }

        buffer.push(line)
      }
    }

    flush()

    return result
  })
</script>

<div class="space-y-4 text-base leading-7">
  {#each blocks as block}
    {#if block.type === 'embed'}
      <div class="min-w-0 space-y-2 not-prose">
        <iframe
          title={block.title}
          src={block.src}
          width="100%"
          height={block.height}
          loading="lazy"
          allow="autoplay"
          class="w-full max-w-full rounded-sm border-0"
        ></iframe>
        <a
          href={block.href}
          target="_blank"
          rel="noopener noreferrer"
          class="block text-xs text-muted-foreground underline underline-offset-2"
          >Listen on SoundCloud</a
        >
      </div>
    {:else if block.type === 'heading'}
      <h2 class="pt-3 text-xl font-black tracking-tight"><InlineMarkdown value={block.text} /></h2>
    {:else if block.type === 'quote'}
      <blockquote class="border-l-4 border-highlight pl-4 italic text-muted-foreground">
        <InlineMarkdown value={block.text} />
      </blockquote>
    {:else if block.type === 'list'}
      <div class="ml-5 list-item list-disc"><InlineMarkdown value={block.text} /></div>
    {:else if block.type === 'code'}
      <pre class="overflow-x-auto bg-muted p-4 text-sm"><code>{block.text}</code></pre>
    {:else}
      <p class="break-words"><InlineMarkdown value={block.text} /></p>
    {/if}
  {/each}
</div>
