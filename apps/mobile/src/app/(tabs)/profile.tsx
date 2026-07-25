import { useRouter } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import Login from '@/components/Login'
import { AppearanceSection } from '@/components/Profile/AppearanceSection'
import { Screen } from '@/components/Screen'
import { useAuthStore, useClearAuth } from '@/store/auth'
import { useThemeColors } from '@/theme/colors'

const musicNoteSymbol = { ios: 'music.note', android: 'music_note', web: 'music_note' } as const

export default function Profile() {
  const user = useAuthStore((state) => state.user)
  const router = useRouter()
  const clearAuth = useClearAuth()
  const colors = useThemeColors()

  if (!user) {
    return <Login />
  }

  return (
    <Screen>
      <ScrollView className='flex-1 p-4'>
        <View className='mb-6'>
          <Text style={{ color: colors.strong, fontSize: 30, fontWeight: '700', marginBottom: 8 }}>
            {user.name}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 18 }}>@{user.username}</Text>
        </View>

        <View className='mt-8'>
          <Text style={{ color: colors.strong, fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
            Features
          </Text>

          <TouchableOpacity
            accessibilityRole='button'
            accessibilityLabel='Open music reminders'
            onPress={() => router.push('/music-reminders')}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 4,
              padding: 16,
              marginBottom: 16
            }}>
            <View className='flex-row items-center justify-between'>
              <View>
                <Text style={{ color: colors.strong, fontSize: 18, fontWeight: '600' }}>
                  Music Reminders
                </Text>
                <Text style={{ color: colors.text, fontSize: 14, marginTop: 4 }}>
                  Never forget to listen to your favorite tracks
                </Text>
              </View>
              <SymbolView name={musicNoteSymbol} size={20} tintColor={colors.muted} />
            </View>
          </TouchableOpacity>
        </View>

        <View className='space-y-4 mb-8'>
          <View>
            <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 4 }}>Email</Text>
            <Text style={{ color: colors.strong, fontSize: 18 }}>{user.email}</Text>
          </View>

          <View>
            <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 4 }}>Verified</Text>
            <Text style={{ color: colors.strong, fontSize: 18 }}>
              {user.verified ? 'Yes' : 'No'}
            </Text>
          </View>

          <View>
            <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 4 }}>User ID</Text>
            <Text style={{ color: colors.strong, fontSize: 14 }}>{user.id}</Text>
          </View>

          <View>
            <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 4 }}>Created At</Text>
            <Text style={{ color: colors.strong, fontSize: 14 }}>
              {new Date(user.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View className='mb-8'>
          <AppearanceSection />
        </View>

        <TouchableOpacity
          onPress={() => void clearAuth()}
          style={{
            borderColor: colors.error,
            borderWidth: 1,
            borderRadius: 4,
            padding: 16,
            marginBottom: 32,
            alignItems: 'center'
          }}>
          <Text style={{ color: colors.error, fontSize: 16, fontWeight: '600' }}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  )
}
