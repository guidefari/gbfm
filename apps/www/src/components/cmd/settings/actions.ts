import { signOut } from '@/lib/auth-client'
import { useUIStore } from '@/store/ui'

export const useSettingsActions = (closeCmd: () => void) => {
  const resetUI = useUIStore((s) => s.resetUI)

  const handleLogout = async () => {
    await signOut()
    resetUI()
    closeCmd()
  }

  return {
    handleLogout
  }
}
