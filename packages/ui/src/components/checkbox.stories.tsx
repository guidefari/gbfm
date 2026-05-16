import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from './card'
import { Checkbox } from './checkbox'
import { Label } from './label'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Checkbox'
}

export function Checkboxes() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Forms'
        title='Checkbox'
        description='Boolean controls with label pairing.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Featured upload</CardTitle>
          <CardDescription>Unchecked state.</CardDescription>
        </CardHeader>
        <CardContent className='flex items-center gap-2'>
          <Checkbox id='featured-upload' />
          <Label htmlFor='featured-upload'>Feature this upload</Label>
        </CardContent>
      </Card>
    </div>
  )
}
