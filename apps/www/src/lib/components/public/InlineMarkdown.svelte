<script lang="ts">
  let { value }: { value: string } = $props()
  type Part = { text: string; href?: string }
  const parts = $derived.by(() => {
    const output: Part[] = []
    const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g
    let cursor = 0
    for (const match of value.matchAll(pattern)) {
      if (match.index > cursor) output.push({ text: value.slice(cursor, match.index) })
      output.push({ text: match[1] ?? match[3], href: match[2] ?? match[3] })
      cursor = match.index + match[0].length
    }
    if (cursor < value.length) output.push({ text: value.slice(cursor) })
    return output
  })
</script>

{#each parts as part}{#if part.href}<a href={part.href} target={part.href.startsWith('http') ? '_blank' : undefined} rel={part.href.startsWith('http') ? 'noopener noreferrer' : undefined} class="underline decoration-highlight underline-offset-2">{part.text}</a>{:else}{part.text.replace(/(\*\*|__|\*|_)/g, '')}{/if}{/each}
