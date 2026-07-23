import { useRouter } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-screens/experimental'
import Login from '@/components/Login'
import { AppearanceSection } from '@/components/Profile/AppearanceSection'
import { useAuthStore, useClearAuth } from '@/store/auth'

const musicNoteSymbol = { ios: 'music.note', android: 'music_note', web: 'music_note' } as const

export default function Profile() {
  const user = useAuthStore((state) => state.user)
  const router = useRouter()
  const clearAuth = useClearAuth()

  if (!user) {
    return <Login />
  }

  return (
    <SafeAreaView edges={{ top: true, left: true, right: true, bottom: true }} className='flex-1'>
      <ScrollView className='flex-1 p-4'>
        <View className='mb-6'>
          <Text className='text-3xl font-bold text-white mb-2'>{user.name}</Text>
          <Text className='text-lg text-gray-300'>@{user.username}</Text>
        </View>

        <View className='mt-8'>
          <Text className='text-xl font-bold text-white mb-4'>Features</Text>

          <TouchableOpacity
            accessibilityRole='button'
            accessibilityLabel='Open music reminders'
            onPress={() => router.push('/music-reminders')}
            className='bg-gray-800 rounded-sm p-4 mb-4'>
            <View className='flex-row items-center justify-between'>
              <View>
                <Text className='text-white font-semibold text-lg'>Music Reminders</Text>
                <Text className='text-gray-300 text-sm mt-1'>
                  Never forget to listen to your favorite tracks
                </Text>
              </View>
              <SymbolView name={musicNoteSymbol} size={20} tintColor='#9CA3AF' />
            </View>
          </TouchableOpacity>
        </View>

        <View className='space-y-4 mb-8'>
          <View>
            <Text className='text-sm text-gray-400 mb-1'>Email</Text>
            <Text className='text-white text-lg'>{user.email}</Text>
          </View>

          <View>
            <Text className='text-sm text-gray-400 mb-1'>Verified</Text>
            <Text className='text-white text-lg'>{user.verified ? 'Yes' : 'No'}</Text>
          </View>

          <View>
            <Text className='text-sm text-gray-400 mb-1'>User ID</Text>
            <Text className='text-white text-sm'>{user.id}</Text>
          </View>

          <View>
            <Text className='text-sm text-gray-400 mb-1'>Created At</Text>
            <Text className='text-white text-sm'>
              {new Date(user.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View className='mb-8'>
          <AppearanceSection />
        </View>

        <TouchableOpacity
          onPress={() => void clearAuth()}
          className='border border-red-400/60 rounded-sm p-4 mb-8 items-center'>
          <Text className='text-red-400 font-semibold text-base'>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
