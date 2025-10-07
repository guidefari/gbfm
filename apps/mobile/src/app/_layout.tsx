import '../global.css'
import { Stack } from 'expo-router'

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: {
          backgroundColor: '#16415A'
        }
      }}
    />
  )
}
