import { useNavigate } from '@tanstack/react-router'
import * as React from 'react'

export const useContentActions = (closeCmd: () => void) => {
  const router = useNavigate()

  const editContent = React.useCallback(
    (archetype: string, id: string) => {
      console.log('editContent called with:', { archetype, id })
      try {
        router({
          to: '/upload',
          search: {
            edit: 'true',
            archetype,
            id
          }
        })
        closeCmd()
        console.log('Navigation triggered successfully')
      } catch (error) {
        console.error('Navigation failed:', error)
      }
    },
    [router, closeCmd]
  )

  return {
    editContent
  }
}
