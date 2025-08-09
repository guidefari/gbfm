import { useAuthStore } from '@/store/auth'

export const useSettingsActions = (closeCmd: () => void) => {
  const { clearAuth } = useAuthStore()

  const handleLogout = () => {
    clearAuth()
    closeCmd()
  }

  return {
    handleLogout
  }
}
