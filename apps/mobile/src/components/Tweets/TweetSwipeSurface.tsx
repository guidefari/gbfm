import {
  beginReaderSwipe,
  finishReaderSwipe,
  moveReaderSwipe,
  type ReaderSwipe,
} from '@gbfm/core/reader-swipe'
import { type PropsWithChildren, useRef } from 'react'
import { type GestureResponderEvent, useWindowDimensions, View } from 'react-native'

const sample = (event: GestureResponderEvent, ending = false) => ({
  x: event.nativeEvent.pageX,
  y: event.nativeEvent.pageY,
  time: event.nativeEvent.timestamp,
  pointers: ending
    ? event.nativeEvent.touches.length === 0
      ? 1
      : 0
    : event.nativeEvent.touches.length,
})

export function TweetSwipeSurface({
  children,
  onSwipe,
  disabled,
}: PropsWithChildren<{
  readonly onSwipe: (direction: 'older' | 'newer') => void
  readonly disabled: boolean
}>) {
  const { width } = useWindowDimensions()
  const swipe = useRef<ReaderSwipe | null>(null)

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={(event) => {
        swipe.current = disabled ? null : beginReaderSwipe(sample(event), width)
      }}
      onTouchMove={(event) => {
        swipe.current = moveReaderSwipe(swipe.current, sample(event))
      }}
      onTouchCancel={() => {
        swipe.current = null
      }}
      onTouchEnd={(event) => {
        const direction = finishReaderSwipe(swipe.current, sample(event, true))
        swipe.current = null

        if (direction && !disabled) onSwipe(direction)
      }}>
      {children}
    </View>
  )
}
