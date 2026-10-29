import type { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useThemeColors, withAlpha } from '@/theme/colors'
import { fonts } from '@/theme/fonts'
import { nextUnread, readerMonth } from '@/tweets/readerState'

import { ReaderButton } from './ReaderButton'

type Props = {
  readonly visible: boolean
  readonly navigation: MicroPostNeighboursResponse | null
  readonly busy: boolean
  readonly failed: boolean
  readonly onClose: () => void
  readonly onGo: (slug: string | null) => void
  readonly onRandom: () => void
  readonly onReset: () => void
  readonly onRetry: () => void
  readonly onArchive: () => void
}

export function ReaderOptions(props: Props) {
  const colors = useThemeColors()
  const target = nextUnread(props.navigation)

  const reset = () =>
    Alert.alert(
      'Reset reading history?',
      'Mark every tweet as unread again and start from the latest. This also resets your signed-in reading history on web.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: props.onReset },
      ],
    )

  return (
    <Modal visible={props.visible} animationType='slide' transparent onRequestClose={props.onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: withAlpha(colors.shadow, 0.5),
        }}>
        <Pressable
          accessibilityRole='button'
          accessibilityLabel='Close reading options'
          onPress={props.onClose}
          style={{ flex: 1 }}
        />
        <SafeAreaView
          edges={['bottom']}
          style={{
            height: '80%',
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderColor: colors.muted,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: 20,
            }}>
            <Text
              accessibilityRole='header'
              style={{ color: colors.strong, fontFamily: fonts.monoSemiBold, fontSize: 18 }}>
              Reading options
            </Text>
            <ReaderButton label='Close' onPress={props.onClose} />
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 14 }}>
            <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 12 }}>
              {props.navigation
                ? `${props.navigation.unreadCount} unread`
                : props.failed
                  ? 'Unread navigation unavailable'
                  : 'Checking unread…'}
            </Text>
            {'slug' in target ? (
              <ReaderButton
                label={`Next unread (${target.kind})`}
                primary
                disabled={props.busy}
                onPress={() => props.onGo(target.slug)}
              />
            ) : target.kind === 'caught-up' ? (
              <View style={{ gap: 8 }}>
                <Text
                  accessibilityRole='text'
                  style={{ color: colors.accent, fontFamily: fonts.mono }}>
                  Caught up
                </Text>
                <ReaderButton label='Start over' primary disabled={props.busy} onPress={reset} />
              </View>
            ) : props.failed ? (
              <ReaderButton label='Retry navigation' onPress={props.onRetry} />
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <ReaderButton
                  label='Latest'
                  disabled={props.busy}
                  onPress={() => props.onGo(null)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ReaderButton
                  label='Random unread'
                  disabled={props.busy || !props.navigation || target.kind === 'caught-up'}
                  onPress={props.onRandom}
                />
              </View>
            </View>
            <ReaderButton label='Browse feed archive' onPress={props.onArchive} />
            <Text style={{ color: colors.strong, fontFamily: fonts.monoSemiBold, fontSize: 13 }}>
              Jump to month
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {props.navigation?.timeline.map((month) => (
                <View key={month.month} style={{ flexBasis: '48%', flexGrow: 1 }}>
                  <ReaderButton
                    label={`${readerMonth(`${month.month}-01T00:00:00Z`)} · ${month.unread}/${month.total}`}
                    accessibilityLabel={`${readerMonth(`${month.month}-01T00:00:00Z`)} · ${month.unread} of ${month.total} unread`}
                    disabled={props.busy}
                    onPress={() => props.onGo(month.newestSlug)}
                  />
                </View>
              ))}
            </View>
            <ReaderButton
              label='Reset reading history…'
              disabled={props.busy || !props.navigation}
              onPress={reset}
            />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  )
}
