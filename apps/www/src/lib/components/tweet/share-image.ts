const WIDTH = 1200

const HEIGHT = 630

const MAX_LINE_WIDTH = 1000

const drawCard = (content: string) => {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')

  if (!context) return null
  context.fillStyle = '#16415a'
  context.fillRect(0, 0, WIDTH, HEIGHT)
  context.fillStyle = '#9bd8e8'
  context.font = 'bold 44px JetBrainsMono, monospace'
  let line = ''
  let y = 120

  for (const word of content.split(/\s+/)) {
    const next = `${line}${word} `

    if (context.measureText(next).width > MAX_LINE_WIDTH) {
      context.fillText(line, 100, y)
      line = `${word} `
      y += 62
    } else line = next
  }

  context.fillText(line, 100, y)
  context.fillStyle = '#55cef6'
  context.font = 'bold 30px JetBrainsMono, monospace'
  context.fillText('goosebumps.fm', 100, 560)

  return canvas
}

export const shareTweetImage = async (slug: string, title: string, content: string) => {
  const canvas = drawCard(content)

  if (!canvas) return
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))

  if (!blob) return
  const file = new File([blob], `${slug}.png`, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title })

    return
  }

  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = file.name
  link.click()
  URL.revokeObjectURL(link.href)
}
