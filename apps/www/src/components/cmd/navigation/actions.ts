import { useNavigate } from '@tanstack/react-router'
import * as React from 'react'

export const useNavigationActions = (closeCmd: () => void) => {
  const router = useNavigate()

  const routeToMixes = React.useCallback(() => {
    router({ to: '/mixes' })
    closeCmd()
  }, [router, closeCmd])

  const routeToLogin = React.useCallback(() => {
    router({ to: '/auth/sign-in' })
    closeCmd()
  }, [router, closeCmd])

  const routeToProfile = React.useCallback(() => {
    router({ to: '/settings/profile' })
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

  return {
    routeToMixes,
    routeToLogin,
    routeToProfile,
    routeToHome,
    routeToTracks,
    routeToLabels,
    routeToUpload,
    routeToAdmin
  }
}
