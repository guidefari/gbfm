import {
  beginReaderSwipe,
  finishReaderSwipe,
  moveReaderSwipe,
  readerSwipeOffset,
  type ReaderSwipe,
} from '@gbfm/core/reader-swipe'
import { useFocusEffect } from 'expo-router'
import { type PropsWithChildren, useCallback, useEffect } from 'react'
import { useWindowDimensions } from 'react-native'
import {
  GestureDetector,
  GestureHandlerRootView,
  GestureStateManager,
  usePanGesture,
  useNativeGesture,
} from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { SwipeGestureContext } from './SwipeExclusion'
import { useReaderReducedMotion } from './useReaderMotion'

export function TweetSwipeSurface({
  children,
  onSwipe,
  disabled,
  newer,
  older,
  entering,
}: PropsWithChildren<{
  readonly onSwipe: (direction: 'older' | 'newer') => void
  readonly disabled: boolean
  readonly newer: boolean
  readonly older: boolean
  readonly entering: 'older' | 'newer' | null
}>) {
  const { width } = useWindowDimensions()
  const reduced = useReaderReducedMotion()
  const swipe = useSharedValue<ReaderSwipe | null>(null)
  const offset = useSharedValue(0)
  const opacity = useSharedValue(1)
  const settling = useSharedValue(false)
  const enabled = useSharedValue(!disabled)

  const cancel = useCallback(() => {
    enabled.set(false)
    cancelAnimation(offset)
    cancelAnimation(opacity)
    offset.set(0)
    opacity.set(1)
    swipe.set(null)
    settling.set(false)
  }, [enabled, offset, opacity, swipe, settling])

  useFocusEffect(
    useCallback(() => {
      enabled.set(!disabled)

      return cancel
    }, [cancel, disabled, enabled]),
  )

  useEffect(() => {
    if (!entering || reduced) return
    offset.set(entering === 'older' ? 48 : -48)
    offset.set(withSpring(0, { damping: 24, stiffness: 260, mass: 0.8 }))
  }, [entering, reduced, offset])

  const pan = usePanGesture({
    activeOffsetX: [-18, 18],
    failOffsetY: [-10, 10],
    maxPointers: 1,
    onTouchesDown: (event) => {
      'worklet'

      if (!enabled.get() || settling.get()) {
        GestureStateManager.fail(event.handlerTag)

        return
      }

      const touch = event.allTouches[0]
      swipe.set(
        touch
          ? beginReaderSwipe(
              {
                x: touch.absoluteX,
                y: touch.absoluteY,
                time: Date.now(),
                pointers: event.numberOfTouches,
              },
              width,
            )
          : null,
      )

      if (!swipe.get()) GestureStateManager.fail(event.handlerTag)
    },
    onTouchesMove: (event) => {
      'worklet'
      const touch = event.allTouches[0]

      const moved = touch
        ? moveReaderSwipe(swipe.get(), {
            x: touch.absoluteX,
            y: touch.absoluteY,
            time: Date.now(),
            pointers: event.numberOfTouches,
          })
        : null

      swipe.set(moved)

      if (!moved || moved.axis === 'vertical' || moved.maxVertical > 40) {
        GestureStateManager.fail(event.handlerTag)

        return
      }

      if (moved.axis !== 'horizontal') return
      cancelAnimation(offset)
      const dx = readerSwipeOffset(moved)
      offset.set(reduced ? 0 : readerSwipeOffset(moved, dx < 0 ? older : newer))
    },
    onUpdate: (event) => {
      'worklet'
      offset.set(
        reduced ? 0 : event.translationX * ((event.translationX < 0 ? older : newer) ? 1 : 0.18),
      )
    },
    onDeactivate: (event) => {
      'worklet'

      const direction = !event.canceled
        ? finishReaderSwipe(
            swipe.get(),
            {
              x: event.absoluteX,
              y: event.absoluteY,
              time: Date.now(),
              pointers: 1,
            },
            event.velocityX / 1000,
          )
        : null

      swipe.set(null)

      if (!enabled.get() || !direction || !(direction === 'older' ? older : newer)) {
        offset.set(reduced ? 0 : withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 }))

        return
      }

      settling.set(true)

      if (reduced) {
        scheduleOnRN(onSwipe, direction)

        return
      }

      opacity.set(withTiming(0, { duration: 170 }))
      offset.set(
        withTiming(direction === 'older' ? -width : width, { duration: 170 }, (finished) => {
          if (finished && enabled.get()) scheduleOnRN(onSwipe, direction)
        }),
      )
    },
    onFinalize: () => {
      'worklet'
      swipe.set(null)

      if (!settling.get())
        offset.set(reduced ? 0 : withSpring(0, { damping: 22, stiffness: 240, mass: 0.8 }))
    },
  })

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: offset.get() }],
  }))

  const scroll = useNativeGesture({ requireToFail: pan, cancelsJSResponder: false })

  return (
    <GestureHandlerRootView style={{ flex: 1, overflow: 'hidden' }}>
      <SwipeGestureContext value={{ pan, scroll }}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>
        </GestureDetector>
      </SwipeGestureContext>
    </GestureHandlerRootView>
  )
}
