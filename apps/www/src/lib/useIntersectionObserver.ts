import { type RefObject, useCallback, useEffect, useState } from 'react'

export interface UseIntersectionObserverOptions
  extends IntersectionObserverInit {}

export function useIntersectionObserver<T extends Element = Element>(
  elementRef: RefObject<T | null>,
  options: UseIntersectionObserverOptions = {}
) {
  const { threshold = 0, root = null, rootMargin = '0%' } = options
  const [entry, setEntry] = useState<IntersectionObserverEntry>()

  const updateEntry = useCallback(
    ([entry]: IntersectionObserverEntry[]): void => {
      setEntry(entry)
    },
    []
  )

  useEffect(() => {
    const node = elementRef?.current
    const hasIOSupport = !!window.IntersectionObserver

    if (!hasIOSupport || !node) {
      return
    }

    const observerParams = { threshold, root, rootMargin }
    const observer = new IntersectionObserver(updateEntry, observerParams)

    observer.observe(node)

    return () => observer.disconnect()
  }, [elementRef, threshold, root, rootMargin, updateEntry])

  return entry
}
