import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'

export const useSettingsActions = (closeCmd: () => void) => {
  const { clearAuth } = useAuthStore()
  const resetUI = useUIStore((s) => s.resetUI)

  const handleLogout = () => {
    clearAuth()
    resetUI()
    closeCmd()
  }

  return {
    handleLogout
  }
}
