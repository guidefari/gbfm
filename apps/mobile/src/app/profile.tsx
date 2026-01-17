import { Stack, useRouter } from 'expo-router'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useAuthStore } from '@/store/auth'

export default function Profile() {
  const user = useAuthStore((state) => state.user)
  const router = useRouter()

  if (!user) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Profile'
          }}
        />
        <View className='flex-1 items-center justify-center p-4'>
          <Text className='text-white text-lg'>No user data available</Text>
        </View>
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Profile'
        }}
      />
      <ScrollView className='flex-1 p-4'>
        <View className='mb-6'>
          <Text className='text-3xl font-bold text-white mb-2'>
            {user.name}
          </Text>
          <Text className='text-lg text-gray-300'>@{user.username}</Text>
        </View>

        <View className='mt-8'>
          <Text className='text-xl font-bold text-white mb-4'>Features</Text>

          <TouchableOpacity
            onPress={() => router.push('/music-reminders')}
            className='bg-gray-800 rounded-lg p-4 mb-4'>
            <View className='flex-row items-center justify-between'>
              <View>
                <Text className='text-white font-semibold text-lg'>
                  Music Reminders
                </Text>
                <Text className='text-gray-300 text-sm mt-1'>
                  Never forget to listen to your favorite tracks
                </Text>
              </View>
              <Text className='text-gray-400 text-xl'>🎵</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View className='space-y-4'>
          <View>
            <Text className='text-sm text-gray-400 mb-1'>Email</Text>
            <Text className='text-white text-lg'>{user.email}</Text>
          </View>

          <View>
            <Text className='text-sm text-gray-400 mb-1'>Verified</Text>
            <Text className='text-white text-lg'>
              {user.verified ? 'Yes' : 'No'}
            </Text>
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
      </ScrollView>
    </>
  )
}
