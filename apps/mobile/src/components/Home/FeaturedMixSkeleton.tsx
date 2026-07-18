import { brand } from '@gbfm/theme'
import { ActivityIndicator, View } from 'react-native'

export function FeaturedMixSkeleton() {
  return (
    <View
      style={{
        aspectRatio: 1,
        backgroundColor: brand.darkerBg,
        borderWidth: 2,
        borderColor: brand['pastel-green-2'],
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center'
      }}>
      <ActivityIndicator size='large' color={brand['pastel-green-1']} />
    </View>
  )
}
