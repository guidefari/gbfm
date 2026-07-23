import { brand } from '@gbfm/theme'
import { SymbolView } from 'expo-symbols'
import { useState } from 'react'
import { Image, Modal, Pressable, Text, View } from 'react-native'
import { useNowPlaying } from '@/audio/NowPlayingProvider'
import { fonts } from '@/theme/fonts'

const colors = {
  background: brand.bg,
  surface: brand.darkerBg,
  accent: brand['pastel-green-1'],
  muted: brand['pastel-green-2'],
  text: brand.defaultText
}

export function QueueSheet() {
  const { queue, skipTo, removeFromQueue } = useNowPlaying()
  const [isOpen, setIsOpen] = useState(false)

  const queueLength = queue.tracks.length

  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 4
        }}>
        <Text
          style={{
            color: colors.text,
            fontFamily: fonts.monoSemiBold,
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: 2
          }}>
          Queue {queueLength > 0 ? `· ${queueLength}` : ''}
        </Text>
        <Pressable
          accessibilityRole='button'
          hitSlop={8}
          onPress={() => setIsOpen(true)}
          style={({ pressed }) => ({ paddingHorizontal: 8, opacity: pressed ? 0.6 : 1 })}>
          <Text
            style={{
              color: colors.accent,
              fontFamily: fonts.monoSemiBold,
              fontSize: 13
            }}>
            Open
          </Text>
        </Pressable>
      </View>

      {queueLength > 0 ? (
        <View style={{ gap: 4 }}>
          {queue.tracks
            .slice(Math.max(0, queue.currentIndex), queue.currentIndex + 2)
            .map((track) => {
              const isCurrent = track.id === queue.current?.id
              return (
                <View
                  key={track.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    borderRadius: 4,
                    backgroundColor: isCurrent ? `${colors.accent}1A` : 'transparent'
                  }}>
                  {track.thumbnailUrl ? (
                    <Image
                      source={{ uri: track.thumbnailUrl }}
                      style={{ width: 28, height: 28, borderRadius: 2 }}
                      resizeMode='cover'
                    />
                  ) : (
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 2,
                        backgroundColor: colors.surface
                      }}
                    />
                  )}
                  <Text
                    style={{
                      flex: 1,
                      color: isCurrent ? colors.accent : '#FFFFFF',
                      fontFamily: fonts.monoSemiBold,
                      fontSize: 12
                    }}
                    numberOfLines={1}>
                    {track.title}
                  </Text>
                  {isCurrent ? (
                    <Text
                      style={{
                        color: colors.accent,
                        fontFamily: fonts.mono,
                        fontSize: 10,
                        letterSpacing: 1
                      }}>
                      PLAYING
                    </Text>
                  ) : null}
                </View>
              )
            })}
        </View>
      ) : (
        <Text
          style={{
            color: `${colors.muted}99`,
            fontFamily: fonts.mono,
            fontSize: 12,
            paddingHorizontal: 4
          }}>
          Your queue is empty.
        </Text>
      )}

      <Modal
        visible={isOpen}
        animationType='slide'
        presentationStyle='pageSheet'
        onRequestClose={() => setIsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: `${colors.muted}33`
            }}>
            <Text
              style={{
                color: colors.text,
                fontFamily: fonts.monoSemiBold,
                fontSize: 18
              }}>
              Queue {queueLength > 0 ? `· ${queueLength}` : ''}
            </Text>
            <Pressable accessibilityRole='button' hitSlop={12} onPress={() => setIsOpen(false)}>
              <Text
                style={{
                  color: colors.accent,
                  fontFamily: fonts.monoSemiBold,
                  fontSize: 14
                }}>
                Done
              </Text>
            </Pressable>
          </View>

          {queueLength === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                gap: 8
              }}>
              <Text
                style={{
                  color: colors.muted,
                  fontFamily: fonts.monoSemiBold,
                  fontSize: 16,
                  textAlign: 'center'
                }}>
                Nothing queued yet
              </Text>
              <Text
                style={{
                  color: `${colors.text}99`,
                  fontFamily: fonts.mono,
                  fontSize: 12,
                  textAlign: 'center'
                }}>
                Add tracks from a show or mix to build your queue.
              </Text>
            </View>
          ) : (
            <View style={{ padding: 12, gap: 4 }}>
              {queue.tracks.map((track, index) => {
                const isCurrent = index === queue.currentIndex
                return (
                  <View
                    key={track.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 10,
                      borderRadius: 4,
                      backgroundColor: isCurrent ? `${colors.accent}1F` : colors.surface
                    }}>
                    <Pressable
                      accessibilityRole='button'
                      hitSlop={8}
                      onPress={() => {
                        skipTo(index)
                        setIsOpen(false)
                      }}
                      style={({ pressed }) => ({
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        opacity: pressed ? 0.7 : 1
                      })}>
                      {track.thumbnailUrl ? (
                        <Image
                          source={{ uri: track.thumbnailUrl }}
                          style={{ width: 40, height: 40, borderRadius: 2 }}
                          resizeMode='cover'
                        />
                      ) : (
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            backgroundColor: `${colors.muted}33`
                          }}
                        />
                      )}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={{
                            color: isCurrent ? colors.accent : '#FFFFFF',
                            fontFamily: fonts.monoSemiBold,
                            fontSize: 14
                          }}
                          numberOfLines={1}>
                          {track.title}
                        </Text>
                        <Text
                          style={{
                            color: colors.muted,
                            fontFamily: fonts.mono,
                            fontSize: 11
                          }}
                          numberOfLines={1}>
                          {track.creators?.map((c) => c.name).join(', ') ?? track.type}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      accessibilityRole='button'
                      accessibilityLabel='Remove from queue'
                      hitSlop={8}
                      onPress={() => removeFromQueue(index)}
                      style={({ pressed }) => ({
                        width: 32,
                        height: 32,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: pressed ? 0.6 : 1
                      })}>
                      <SymbolView name='xmark' size={16} tintColor={colors.muted} />
                    </Pressable>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </Modal>
    </View>
  )
}
