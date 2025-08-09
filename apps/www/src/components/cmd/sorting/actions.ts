import * as React from 'react'
import { useUIStore } from '@/store'

export const useSortingActions = (closeCmd: () => void) => {
  const { setSortBy, toggleSortOrder } = useUIStore()

  const sortByDate = React.useCallback(() => {
    setSortBy('date')
    closeCmd()
  }, [setSortBy, closeCmd])

  const sortByTitle = React.useCallback(() => {
    setSortBy('title')
    closeCmd()
  }, [setSortBy, closeCmd])

  const toggleSort = React.useCallback(() => {
    toggleSortOrder()
    closeCmd()
  }, [toggleSortOrder, closeCmd])

  return {
    sortByDate,
    sortByTitle,
    toggleSort
  }
}
