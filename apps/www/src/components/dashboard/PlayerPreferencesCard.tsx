import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useUIStore } from '@/store/ui'

export function PlayerPreferencesCard() {
  const { preferredPlayerType, setPreferredPlayerType } = useUIStore()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Player Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <p className='text-sm text-muted-foreground mb-4'>
            Choose how the audio player appears across the app
          </p>
          <div className='flex gap-3'>
            <button
              type='button'
              onClick={() => setPreferredPlayerType('full')}
              className={`flex-1 px-4 py-3 rounded-sm border transition-all text-left ${
                preferredPlayerType === 'full'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}>
              <div className='font-medium'>Full Player</div>
              <div className='text-xs text-muted-foreground mt-1'>
                Bottom bar with all controls
              </div>
            </button>
            <button
              type='button'
              onClick={() => setPreferredPlayerType('compact')}
              className={`flex-1 px-4 py-3 rounded-sm border transition-all text-left ${
                preferredPlayerType === 'compact'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}>
              <div className='font-medium'>Compact Player</div>
              <div className='text-xs text-muted-foreground mt-1'>
                Floating mini player
              </div>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
