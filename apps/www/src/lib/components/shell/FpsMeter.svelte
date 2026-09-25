<script lang="ts">
  import { onMount } from 'svelte'

  let fps = $state(0)

  onMount(() => {
    let frame = 0
    let frames = 0
    let previous = performance.now()

    const measure = (now: number) => {
      frames += 1
      if (now - previous >= 500) {
        fps = Math.round((frames * 1000) / (now - previous))
        frames = 0
        previous = now
      }
      frame = requestAnimationFrame(measure)
    }

    frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  })
</script>

<output class="fixed right-2 top-14 z-[70] bg-black/75 px-2 py-1 text-[10px] font-bold text-white" aria-label="Frames per second">
  {fps} FPS
</output>
