import { Stack } from 'expo-router'
import { useStackScreenOptions } from '@/theme/navigation'

export default function HomeStackLayout() {
  const screenOptions = useStackScreenOptions()

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name='index' options={{ headerShown: false }} />
      <Stack.Screen name='show/[slug]' options={{ headerShown: true, title: '' }} />
    </Stack>
  )
}
