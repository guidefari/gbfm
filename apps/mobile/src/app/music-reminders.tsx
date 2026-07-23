import { Stack, useRouter } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useAuthStore } from '@/store/auth'

const symbols = {
  add: { ios: 'plus', android: 'add', web: 'add' },
  complete: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  construction: { ios: 'hammer.fill', android: 'construction', web: 'construction' }
} as const

export default function MusicReminders() {
  const user = useAuthStore((state) => state.user)
  const _router = useRouter()

  if (!user) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Music Reminders'
          }}
        />
        <View className='flex-1 items-center justify-center p-4'>
          <Text className='text-white text-lg'>Please log in to access music reminders</Text>
        </View>
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Music Reminders',
          headerRight: () => (
            <TouchableOpacity
              accessibilityRole='button'
              accessibilityLabel='Add music reminder'
              onPress={() => {
                Alert.alert(
                  'Coming Soon',
                  'Mobile music reminders are coming soon! For now, use the web app at goosebumps.fm/reminders',
                  [{ text: 'OK' }]
                )
              }}
              className='mr-4'>
              <SymbolView name={symbols.add} size={20} tintColor='#FFFFFF' />
            </TouchableOpacity>
          )
        }}
      />
      <ScrollView className='flex-1 p-4'>
        <View className='mb-6'>
          <Text className='text-3xl font-bold text-white mb-2'>Music Reminders</Text>
          <Text className='text-lg text-gray-300'>Never forget to listen to that track again</Text>
        </View>

        <View className='bg-gray-800 rounded-lg p-6 mb-6'>
          <Text className='text-white text-xl font-semibold mb-3'>Coming Soon</Text>
          <Text className='text-gray-300 mb-4'>
            The mobile music reminders feature is currently in development. You can create and
            manage your music reminders on the web app for now.
          </Text>

          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Open Web App',
                'Would you like to open the web app to manage your music reminders?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Open',
                    onPress: () => {
                      // In a real app, you'd use Linking.openURL()
                      Alert.alert('Web App', 'goosebumps.fm/reminders')
                    }
                  }
                ]
              )
            }}
            className='bg-blue-600 rounded-lg py-3 px-6'>
            <Text className='text-white font-semibold text-center'>Use Web App</Text>
          </TouchableOpacity>
        </View>

        <View className='bg-gray-800 rounded-lg p-6'>
          <Text className='text-white text-xl font-semibold mb-3'>Features</Text>

          <View className='space-y-3'>
            <View className='flex-row items-center'>
              <SymbolView
                name={symbols.complete}
                size={16}
                tintColor='#4ADE80'
                style={{ marginRight: 12 }}
              />
              <Text className='text-gray-300'>
                Smart URL enrichment from Spotify, YouTube, Apple Music
              </Text>
            </View>

            <View className='flex-row items-center'>
              <SymbolView
                name={symbols.complete}
                size={16}
                tintColor='#4ADE80'
                style={{ marginRight: 12 }}
              />
              <Text className='text-gray-300'>Album cover previews and auto-fill</Text>
            </View>

            <View className='flex-row items-center'>
              <SymbolView
                name={symbols.complete}
                size={16}
                tintColor='#4ADE80'
                style={{ marginRight: 12 }}
              />
              <Text className='text-gray-300'>Scheduled email reminders</Text>
            </View>

            <View className='flex-row items-center'>
              <SymbolView
                name={symbols.complete}
                size={16}
                tintColor='#4ADE80'
                style={{ marginRight: 12 }}
              />
              <Text className='text-gray-300'>Beautiful email templates with track details</Text>
            </View>

            <View className='flex-row items-center'>
              <SymbolView
                name={symbols.construction}
                size={16}
                tintColor='#FACC15'
                style={{ marginRight: 12 }}
              />
              <Text className='text-gray-300'>Mobile app integration (coming soon)</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  )
}
