import { Text, View } from 'react-native'

import { useThemeColors } from '@/theme/colors'
import { fonts } from '@/theme/fonts'
import { readerMonth } from '@/tweets/readerState'

import { ReaderButton } from './ReaderButton'

export function ReaderHeader({
  date,
  onOptions,
}: {
  readonly date: string
  readonly onOptions: () => void
}) {
  const colors = useThemeColors()

  return (
    <View style={{ gap: 2, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
        <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 12 }}>
          {readerMonth(date)}
        </Text>
        <ReaderButton label='Reading options' quiet onPress={onOptions} />
      </View>
      <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 11 }}>
        Swipe left for older · right for newer
      </Text>
    </View>
  )
}
