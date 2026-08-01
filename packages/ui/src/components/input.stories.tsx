import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Input } from './input'
import { Label } from './label'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Primitives/Input'
}

export function Inputs() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Forms'
        title='Input'
        description='Single-line text entry with label pairing.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Catalog name</CardTitle>
          <CardDescription>Default input state.</CardDescription>
        </CardHeader>
        <CardContent className='max-w-md space-y-2'>
          <Label htmlFor='catalog-name'>Catalog name</Label>
          <Input id='catalog-name' placeholder='Artist, show, or label name' />
        </CardContent>
      </Card>
    </div>
  )
}
