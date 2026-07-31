import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'
import { Textarea } from './textarea'

export default {
  title: '@gbfm/ui/Primitives/Textarea'
}

export function Textareas() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Forms'
        title='Textarea'
        description='Multi-line text entry for descriptions and notes.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
          <CardDescription>Default textarea state.</CardDescription>
        </CardHeader>
        <CardContent className='max-w-md'>
          <Textarea placeholder='Short description' />
        </CardContent>
      </Card>
    </div>
  )
}
