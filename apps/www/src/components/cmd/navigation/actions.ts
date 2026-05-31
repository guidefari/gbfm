import { useNavigate } from '@tanstack/react-router'
import * as React from 'react'

export const useNavigationActions = (closeCmd: () => void) => {
  const navigate = useNavigate()

  const routeTo = React.useCallback(
    (to: string) => {
      navigate({ to })
      closeCmd()
    },
    [navigate, closeCmd]
  )

  const routeToMixes = React.useCallback(() => routeTo('/mixes'), [routeTo])
  const routeToLogin = React.useCallback(
    () => routeTo('/auth/sign-in'),
    [routeTo]
  )
  const routeToSettings = React.useCallback(
    () => routeTo('/settings'),
    [routeTo]
  )
  const routeToDashboard = React.useCallback(
    () => routeTo('/dashboard'),
    [routeTo]
  )
  const routeToUpload = React.useCallback(
    () => routeTo('/mix-upload'),
    [routeTo]
  )
  const routeToAdmin = React.useCallback(() => routeTo('/admin'), [routeTo])
  const routeToLabelUpload = React.useCallback(
    () => routeTo('/label-upload'),
    [routeTo]
  )
  const routeToReminders = React.useCallback(
    () => routeTo('/reminders'),
    [routeTo]
  )

  return {
    routeTo,
    routeToMixes,
    routeToLogin,
    routeToSettings,
    routeToDashboard,
    routeToUpload,
    routeToAdmin,
    routeToLabelUpload,
    routeToReminders
  }
}
