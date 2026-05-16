import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from './card'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Card'
}

export function Cards() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Surface'
        title='Card'
        description='Contained surface for grouped product content.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Upload details</CardTitle>
          <CardDescription>Card header and content spacing.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>
            Primitive card, text, and content styling in one place.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
