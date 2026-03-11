// todo: there's an infinite loop somewhere in here, LOL

import React from 'react'
import type { ViewStyle } from 'react-native'
import { StyleSheet, View } from 'react-native'
import Svg, { Rect, Text as SvgText } from 'react-native-svg'

const supportedFps = [60, 120, 144, 160, 240] as const

const getFrameBarWidth = (fps: number): number => {
  if (fps <= 60) return 2
  if (fps <= 144) return 1
  return 0.5
}

export type FPSMeterProps = {
  width?: number
  height?: number
  initialSystemFps?: number
  style?: ViewStyle
}

const FRAME_HIT = Symbol('FRAME_HIT')
const FRAME_MISS = Symbol('FRAME_MISS')
const FRAME_UNINITIALIZED = Symbol('FRAME_UNINITIALIZED')

type FrameValue =
  | typeof FRAME_HIT
  | typeof FRAME_MISS
  | typeof FRAME_UNINITIALIZED

export const FPSMeter: React.FC<FPSMeterProps> = ({
  width = 120,
  height = 30,
  initialSystemFps = 60,
  style
}) => {
  const [systemFps, setSystemFps] = React.useState<number>(initialSystemFps)
  const [frames, setFrames] = React.useState<FrameValue[]>([])
  const [currentFrameNumber, setCurrentFrameNumber] = React.useState(0)
  const [averageFps, setAverageFps] = React.useState<number | null>(null)

  const frameBarWidth = React.useMemo(
    () => getFrameBarWidth(systemFps),
    [systemFps]
  )
  const numberOfVisibleFrames = React.useMemo(
    () => Math.floor(width / frameBarWidth),
    [width, frameBarWidth]
  )

  const last500FrameDurations = React.useRef<number[]>(
    Array.from<number>({ length: 500 }).fill(0)
  )

  const readjustSystemFps = React.useCallback(() => {
    const nonZero = last500FrameDurations.current.filter((_) => _ > 0).sort()
    if (nonZero.length < 10) return

    const medianIndex = Math.floor(nonZero.length / 2)
    const tenFramesAroundMedian = nonZero.slice(
      medianIndex - 5,
      medianIndex + 5
    )
    const sumOfTenFramesAroundMedian = tenFramesAroundMedian.reduce(
      (acc, _) => acc + _,
      0
    )
    const newSystemFps = Math.round(10_000 / sumOfTenFramesAroundMedian)

    const closestFps = supportedFps.find(
      (fps) => Math.abs(newSystemFps - fps) < 10
    )

    if (closestFps === undefined) {
      console.warn(`Unsupported system FPS ${newSystemFps}`)
      return
    }

    if (systemFps !== closestFps) {
      setSystemFps(closestFps)
    }
  }, [systemFps])

  const resolutionInMs = 1000 / systemFps

  const numberOfSecondsForAverageFps = 2
  const numberOfFramesForAverageFps = Math.min(
    numberOfSecondsForAverageFps * systemFps,
    numberOfVisibleFrames
  )

  const previousFrameNumberRef = React.useRef(0)
  const previousFrameTimeRef = React.useRef(0)
  const animationFrameRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    setFrames(new Array(numberOfVisibleFrames).fill(FRAME_UNINITIALIZED))
  }, [numberOfVisibleFrames])

  React.useEffect(() => {
    const loop = () => {
      const now = performance.now()

      animationFrameRef.current = requestAnimationFrame(() => {
        loop()

        const frameNumber = Math.floor(now / resolutionInMs)
        const numberOfSkippedFrames =
          frameNumber - previousFrameNumberRef.current - 1

        setFrames((prevFrames) => {
          const newFrames = [...prevFrames]

          for (let i = 0; i < numberOfSkippedFrames; i++) {
            newFrames.shift()
            newFrames.push(FRAME_MISS)
          }

          newFrames.shift()
          newFrames.push(FRAME_HIT)

          return newFrames
        })

        previousFrameNumberRef.current = frameNumber

        const frameDuration = now - previousFrameTimeRef.current
        previousFrameTimeRef.current = now
        last500FrameDurations.current.shift()
        last500FrameDurations.current.push(frameDuration)

        if (frameNumber % 100 === 0) {
          readjustSystemFps()
        }

        setCurrentFrameNumber(frameNumber)
      })
    }

    loop()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [resolutionInMs, readjustSystemFps])

  React.useEffect(() => {
    let frameCount = 0
    let numberOfInitializedFrames = 0

    for (let i = 0; i < numberOfFramesForAverageFps; i++) {
      const frameHit = frames.at(-i - 1)
      if (frameHit && frameHit !== FRAME_UNINITIALIZED) {
        frameCount += frameHit === FRAME_HIT ? 1 : 0
        numberOfInitializedFrames++
      }
    }

    if (numberOfInitializedFrames >= numberOfFramesForAverageFps) {
      const avgFps = Math.round(
        (systemFps * frameCount) / numberOfInitializedFrames
      )
      setAverageFps(avgFps)
    }
  }, [frames, numberOfFramesForAverageFps, systemFps])

  const chunkWidth = (1 / frameBarWidth) * 8

  return (
    <View style={[styles.container, style]} pointerEvents='box-none'>
      <Svg width={width} height={height}>
        {frames.map((frameHit, i) => {
          if (frameHit === FRAME_UNINITIALIZED) return null

          const x = i * frameBarWidth
          const isEvenChunk =
            (currentFrameNumber + i) % (chunkWidth * 2) < chunkWidth

          const fillColor =
            frameHit === FRAME_MISS
              ? 'rgba(255, 0, 0, 1)'
              : isEvenChunk
                ? 'rgba(255, 255, 255, 0.37)'
                : 'rgba(255, 255, 255, 0.4)'

          return (
            <Rect
              // biome-ignore lint/suspicious/noArrayIndexKey: frames are positional
              key={`frame-${currentFrameNumber - frames.length + i}`}
              x={x}
              y={0}
              width={frameBarWidth}
              height={height}
              fill={fillColor}
            />
          )
        })}
        {averageFps !== null && (
          <SvgText
            x={2}
            y={height - 3}
            fill='white'
            fontSize={10}
            fontFamily='monospace'>
            {averageFps} FPS
          </SvgText>
        )}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9999,
    bottom: 0,
    right: 0
  }
})
