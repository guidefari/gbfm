import { Stack } from 'expo-router'
import { Text, View, ScrollView } from 'react-native'
import { useAuthStore } from '@/store/auth'

export default function Profile() {
  const user = useAuthStore((state) => state.user)

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
