import { Text, TouchableOpacity, View } from 'react-native'
import { SPOTIFY_GREEN, SpotifyIcon } from '@/spotify/SpotifyIcon'
import { useConnectSpotify, useDisconnectSpotify, useSpotifyConnection } from '@/spotify/connection'
import { SpotifyToast, useSpotifyToast } from '@/spotify/SpotifyToast'
import { useThemeColors } from '@/theme/colors'
import { SpotifyPasteAndPlay } from './SpotifyPasteAndPlay'

const formatExpiresIn = (expiresAt: number) => {
  const diff = expiresAt - Date.now()
  if (diff <= 0) return 'expired'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `~${minutes}m`
  return `~${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function SpotifySection() {
  const session = useSpotifyConnection((state) => state.session)
  const profile = useSpotifyConnection((state) => state.profile)
  const isBootstrapping = useSpotifyConnection((state) => state.isBootstrapping)
  const isConnecting = useSpotifyConnection((state) => state.isConnecting)
  const error = useSpotifyConnection((state) => state.error)
  const connect = useConnectSpotify()
  const disconnect = useDisconnectSpotify()
  const colors = useThemeColors()
  const { notice, notify } = useSpotifyToast()

  return (
    <View className='mb-8' style={{ position: 'relative' }}>
      <View className='flex-row items-center gap-2 mb-2'>
        <SpotifyIcon size={16} />
        <Text style={{ color: colors.strong, fontSize: 20, fontWeight: '700' }}>Spotify</Text>
      </View>

      {isBootstrapping ? (
        <Text style={{ color: colors.muted, fontSize: 14 }}>Checking session...</Text>
      ) : session ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 4,
            padding: 16,
            gap: 12
          }}>
          <View>
            <Text style={{ color: colors.strong, fontSize: 16, fontWeight: '600' }}>
              {profile?.display_name ?? profile?.id ?? 'Connected'}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
              Token expires {formatExpiresIn(session.accessTokenExpiresAt)}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole='button'
            accessibilityLabel='Disconnect Spotify'
            onPress={disconnect}
            style={{
              borderColor: colors.error,
              borderWidth: 1,
              borderRadius: 4,
              paddingVertical: 10,
              alignItems: 'center'
            }}>
            <Text style={{ color: colors.error, fontSize: 14, fontWeight: '600' }}>Disconnect</Text>
          </TouchableOpacity>

          <SpotifyPasteAndPlay onNotice={notify} />
        </View>
      ) : (
        <TouchableOpacity
          accessibilityRole='button'
          accessibilityLabel='Connect Spotify'
          disabled={isConnecting}
          onPress={() => void connect()}
          style={{
            backgroundColor: SPOTIFY_GREEN,
            borderRadius: 4,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: isConnecting ? 0.6 : 1
          }}>
          <Text style={{ color: '#000', fontSize: 15, fontWeight: '700' }}>
            {isConnecting ? 'Connecting...' : 'Connect Spotify'}
          </Text>
        </TouchableOpacity>
      )}

      {error ? (
        <Text style={{ color: colors.error, fontSize: 13, marginTop: 8 }}>{error}</Text>
      ) : null}

      <SpotifyToast notice={notice} />
    </View>
  )
}
