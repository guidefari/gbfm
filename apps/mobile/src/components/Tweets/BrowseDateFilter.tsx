import { browseMonthLabel, type BrowseMonth } from '@gbfm/core/tweet-browse'
import { radii } from '@gbfm/theme'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useThemeColors, withAlpha } from '@/theme/colors'
import { fonts } from '@/theme/fonts'

import { ReaderButton } from './ReaderButton'

export function BrowseDateFilter({
  timeline,
  selected,
  onSelect,
}: {
  readonly timeline: ReadonlyArray<BrowseMonth>
  readonly selected: string | null
  readonly onSelect: (month: string | null) => void
}) {
  const colors = useThemeColors()
  const [open, setOpen] = useState(false)
  const years = [...new Set(timeline.map((entry) => entry.month.slice(0, 4)))]
  const [year, setYear] = useState(selected?.slice(0, 4) ?? years[0] ?? '')

  const choose = (month: string | null) => {
    setOpen(false)
    onSelect(month)
  }

  return (
    <>
      <ReaderButton
        label={selected ? browseMonthLabel(selected) : 'All dates'}
        glyph='chevronDown'
        onPress={() => {
          setYear(selected?.slice(0, 4) ?? years[0] ?? '')
          setOpen(true)
        }}
      />
      <Modal visible={open} transparent animationType='slide' onRequestClose={() => setOpen(false)}>
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: withAlpha(colors.shadow, 0.5),
          }}>
          <Pressable
            accessibilityRole='button'
            accessibilityLabel='Close date filter'
            onPress={() => setOpen(false)}
            style={{ flex: 1 }}
          />
          <SafeAreaView
            edges={['bottom']}
            style={{
              maxHeight: '75%',
              backgroundColor: colors.background,
              borderTopLeftRadius: radii.overlay,
              borderTopRightRadius: radii.overlay,
            }}>
            <View style={{ padding: 20, gap: 16 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                <Text
                  accessibilityRole='header'
                  style={{ color: colors.strong, fontFamily: fonts.monoSemiBold, fontSize: 18 }}>
                  Browse by date
                </Text>
                <ReaderButton label='Close' quiet onPress={() => setOpen(false)} />
              </View>
              <ReaderButton
                label='All dates'
                primary={selected === null}
                onPress={() => choose(null)}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}>
                {years.map((value) => (
                  <ReaderButton
                    key={value}
                    label={value}
                    primary={value === year}
                    onPress={() => setYear(value)}
                  />
                ))}
              </ScrollView>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              {timeline.flatMap((entry) =>
                entry.month.startsWith(year)
                  ? [
                      <Pressable
                        key={entry.month}
                        accessibilityRole='button'
                        accessibilityLabel={`Browse ${browseMonthLabel(entry.month)}`}
                        onPress={() => choose(entry.month)}
                        style={({ pressed }) => ({
                          minHeight: 64,
                          justifyContent: 'center',
                          gap: 4,
                          borderBottomWidth: 1,
                          borderColor: withAlpha(colors.muted, 0.2),
                          opacity: pressed ? 0.6 : 1,
                        })}>
                        <Text
                          style={{
                            color: entry.month === selected ? colors.accent : colors.strong,
                            fontFamily: fonts.monoSemiBold,
                            fontSize: 14,
                          }}>
                          {browseMonthLabel(entry.month)}
                        </Text>
                        <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 12 }}>
                          {entry.total} {entry.total === 1 ? 'tweet' : 'tweets'} · {entry.unread}{' '}
                          unread
                        </Text>
                      </Pressable>,
                    ]
                  : [],
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  )
}
