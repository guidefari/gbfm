<script lang="ts">
  import { DEFAULT_IMAGE_URL } from '@/lib/constants'

  let { src, alt, square = true }: { src?: string; alt: string; square?: boolean } = $props()
</script>

<img
  src={src || DEFAULT_IMAGE_URL}
  {alt}
  loading="lazy"
  class:aspect-square={square}
  class="w-full border border-border object-cover"
/>
