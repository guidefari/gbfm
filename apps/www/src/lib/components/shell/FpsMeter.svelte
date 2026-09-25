<script lang="ts">
  import { onMount } from 'svelte'

  const supportedFps = [60, 120, 144, 160, 240] as const

  const frameHit = 1

  const frameMiss = -1

  const frameUninitialized = 0

  onMount(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-fps-meter]')

    if (!canvas) return

    const pixelRatio = Math.round(window.devicePixelRatio || 1)
    const width = 120
    const height = 40
    const adjustedWidth = width * pixelRatio
    const adjustedHeight = height * pixelRatio
    canvas.width = adjustedWidth
    canvas.height = adjustedHeight
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const context = canvas.getContext('2d')

    if (!context) return

    let systemFps: (typeof supportedFps)[number] = 60
    let frameBarWidth = 2
    let visibleFrameCount = Math.floor(adjustedWidth / frameBarWidth)
    let frames = Array<number>(visibleFrameCount).fill(frameUninitialized)
    const durations = Array<number>(500).fill(0)
    let request = 0
    let previousFrameNumber = 0
    let previousFrameTime = 0

    const readjustSystemFps = () => {
      const populated = durations.filter((duration) => duration > 0).sort((a, b) => a - b)

      if (populated.length < 10) return
      const median = Math.floor(populated.length / 2)
      const sample = populated.slice(median - 5, median + 5)
      const detected = Math.round(10_000 / sample.reduce((sum, duration) => sum + duration, 0))
      const closest = supportedFps.find((value) => Math.abs(detected - value) < 10)

      if (!closest || closest === systemFps) return
      systemFps = closest
      frameBarWidth = systemFps <= 60 ? 2 : systemFps <= 144 ? 1 : 0.5
      visibleFrameCount = Math.floor(adjustedWidth / frameBarWidth)
      frames = Array<number>(visibleFrameCount).fill(frameUninitialized)
    }

    const draw = (frameNumber: number) => {
      context.clearRect(0, 0, adjustedWidth, adjustedHeight)
      const chunkWidth = (1 / frameBarWidth) * 8

      for (let index = 0; index < visibleFrameCount; index += 1) {
        const value = frames[index]

        if (value === frameUninitialized) continue
        const evenChunk = (frameNumber + index) % (chunkWidth * 2) < chunkWidth
        context.fillStyle =
          value === frameMiss
            ? 'rgba(255, 0, 0, 1)'
            : evenChunk
              ? 'rgba(255, 255, 255, 0.37)'
              : 'rgba(255, 255, 255, 0.4)'
        context.fillRect(index * frameBarWidth, adjustedHeight, frameBarWidth, -adjustedHeight)
      }

      const averageFrameCount = Math.min(2 * systemFps, visibleFrameCount)
      const sample = frames.slice(-averageFrameCount).filter((value) => value !== frameUninitialized)

      if (sample.length >= averageFrameCount) {
        const hits = sample.filter((value) => value === frameHit).length
        context.fillStyle = 'white'
        context.font = `${pixelRatio * 10}px monospace`
        context.fillText(
          `${Math.round((systemFps * hits) / sample.length)} FPS`,
          2 * pixelRatio,
          adjustedHeight - 3 * pixelRatio
        )
      }
    }

    const loop = () => {
      request = requestAnimationFrame((now) => {
        const resolution = 1000 / systemFps
        const frameNumber = Math.floor(now / resolution)
        const skipped = Math.max(0, frameNumber - previousFrameNumber - 1)

        for (let index = 0; index < skipped; index += 1) {
          frames.shift()
          frames.push(frameMiss)
        }

        frames.shift()
        frames.push(frameHit)
        previousFrameNumber = frameNumber
        durations.shift()
        durations.push(now - previousFrameTime)
        previousFrameTime = now

        if (frameNumber % 100 === 0) readjustSystemFps()
        draw(frameNumber)
        loop()
      })
    }

    loop()

    return () => cancelAnimationFrame(request)
  })
</script>

<canvas data-fps-meter class="fixed right-0 top-0 z-[70] hidden sm:block" aria-label="Frames per second"></canvas>
