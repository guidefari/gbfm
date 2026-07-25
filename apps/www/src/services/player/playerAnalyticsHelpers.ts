export const buildPausedProperties = (input: {
  readonly trackId: string | null
  readonly title: string
  readonly currentTime: number
  readonly duration: number
}) => ({
  trackId: input.trackId,
  title: input.title,
  currentTime: input.currentTime,
  progressPercent: input.duration > 0 ? Math.round((input.currentTime / input.duration) * 100) : 0
})
