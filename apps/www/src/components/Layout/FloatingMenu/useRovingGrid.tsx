import { useCallback, useEffect, useRef, useState } from 'react'

type RovingGridApi = {
  gridRef: React.RefObject<HTMLElement | null>
  registerTile: (index: number) => (node: HTMLElement | null) => void
  getTileProps: (index: number) => {
    tabIndex: number
    onFocus: () => void
    onKeyDown: (event: React.KeyboardEvent) => void
  }
}

const getColumnCount = (grid: HTMLElement | null) => {
  if (!grid) return 1
  const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
  return Math.max(columns, 1)
}

export function useRovingGrid(tileCount: number, isActive: boolean): RovingGridApi {
  const gridRef = useRef<HTMLElement | null>(null)
  const tileRefs = useRef<(HTMLElement | null)[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  const registerTile = useCallback(
    (index: number) => (node: HTMLElement | null) => {
      tileRefs.current[index] = node
    },
    []
  )

  const focusTile = useCallback((index: number) => {
    const tile = tileRefs.current[index]
    if (tile) {
      setActiveIndex(index)
      tile.focus()
    }
  }, [])

  useEffect(() => {
    if (!isActive) return
    setActiveIndex(0)
    for (const tile of tileRefs.current) {
      const innerControl = tile?.querySelector<HTMLElement>('button, a')
      if (innerControl && innerControl !== tile) {
        innerControl.tabIndex = -1
      }
    }
    const raf = requestAnimationFrame(() => {
      tileRefs.current[0]?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [isActive])

  const handleKeyDown = useCallback(
    (index: number) => (event: React.KeyboardEvent) => {
      const columns = getColumnCount(gridRef.current)
      const lastIndex = tileCount - 1
      let nextIndex: number | null = null

      switch (event.key) {
        case 'ArrowRight':
          nextIndex = Math.min(index + 1, lastIndex)
          break
        case 'ArrowLeft':
          nextIndex = Math.max(index - 1, 0)
          break
        case 'ArrowDown':
          nextIndex = Math.min(index + columns, lastIndex)
          break
        case 'ArrowUp':
          nextIndex = Math.max(index - columns, 0)
          break
        case 'Home':
          nextIndex = 0
          break
        case 'End':
          nextIndex = lastIndex
          break
        case ' ':
        case 'Enter': {
          const tile = tileRefs.current[index]
          if (!tile) return
          const innerControl = tile.querySelector<HTMLElement>('button, a')
          const target = innerControl ?? tile
          if (event.key === ' ' || innerControl) {
            event.preventDefault()
            target.click()
          }
          return
        }
        default:
          return
      }

      if (nextIndex !== null && nextIndex !== index) {
        event.preventDefault()
        focusTile(nextIndex)
      }
    },
    [tileCount, focusTile]
  )

  const getTileProps = useCallback(
    (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      onFocus: () => setActiveIndex(index),
      onKeyDown: handleKeyDown(index)
    }),
    [activeIndex, handleKeyDown]
  )

  return { gridRef, registerTile, getTileProps }
}
