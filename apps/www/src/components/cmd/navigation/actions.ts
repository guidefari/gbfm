import { useNavigate } from '@tanstack/react-router'
import * as React from 'react'

export const useNavigationActions = (closeCmd: () => void) => {
  const router = useNavigate()

  const routeToMixes = React.useCallback(() => {
    router({ to: '/mixes' })
    closeCmd()
  }, [router, closeCmd])

  const routeToShows = React.useCallback(() => {
    router({ to: '/shows' })
    closeCmd()
  }, [router, closeCmd])

  const routeToLogin = React.useCallback(() => {
    router({ to: '/auth/sign-in' })
    closeCmd()
  }, [router, closeCmd])

  const routeToSettings = React.useCallback(() => {
    router({ to: '/settings' })
    closeCmd()
  }, [router, closeCmd])

  const routeToDashboard = React.useCallback(() => {
    router({ to: '/dashboard' })
    closeCmd()
  }, [router, closeCmd])

  const routeToHome = React.useCallback(() => {
    router({ to: '/' })
    closeCmd()
  }, [router, closeCmd])

  const routeToTracks = React.useCallback(() => {
    router({ to: '/tracks' })
    closeCmd()
  }, [router, closeCmd])

  const routeToLabels = React.useCallback(() => {
    router({ to: '/labels' })
    closeCmd()
  }, [router, closeCmd])

  const routeToUpload = React.useCallback(() => {
    router({ to: '/mix-upload' })
    closeCmd()
  }, [router, closeCmd])

  const routeToAdmin = React.useCallback(() => {
    router({ to: '/admin' })
    closeCmd()
  }, [router, closeCmd])

  const routeToLabelUpload = React.useCallback(() => {
    router({ to: '/label-upload' })
    closeCmd()
  }, [router, closeCmd])

  const routeToReminders = React.useCallback(() => {
    router({ to: '/reminders' })
    closeCmd()
  }, [router, closeCmd])

  const routeToTweets = React.useCallback(() => {
    router({ to: '/tweet' })
    closeCmd()
  }, [router, closeCmd])

  const routeToEditorial = React.useCallback(() => {
    router({ to: '/editorial' })
    closeCmd()
  }, [router, closeCmd])

  return {
    routeToMixes,
    routeToShows,
    routeToLogin,
    routeToSettings,
    routeToDashboard,
    routeToHome,
    routeToTracks,
    routeToLabels,
    routeToUpload,
    routeToAdmin,
    routeToLabelUpload,
    routeToReminders,
    routeToTweets,
    routeToEditorial
  }
}
