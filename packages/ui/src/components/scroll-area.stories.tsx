import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { ScrollArea } from './scroll-area'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Primitives/Scroll area'
}

export function ScrollAreas() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Structure'
        title='ScrollArea'
        description='Contained scrolling for dense product surfaces.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>Fixed-height scrollable content.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className='h-28 rounded-sm border p-3'>
            <div className='space-y-2 text-sm text-muted-foreground'>
              {['Dub report', 'Ambient dispatch', 'Label notes', 'Club memo', 'Release scan'].map(
                (item) => (
                  <p key={item}>{item}</p>
                )
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
