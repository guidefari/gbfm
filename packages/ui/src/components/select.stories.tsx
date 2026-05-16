import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from './card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './select'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Select'
}

export function Selects() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Forms'
        title='Select'
        description='Single-option picker for compact forms.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Content type</CardTitle>
          <CardDescription>Open to inspect option surface.</CardDescription>
        </CardHeader>
        <CardContent className='max-w-md'>
          <Select defaultValue='mix'>
            <SelectTrigger>
              <SelectValue placeholder='Content type' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='mix'>Mix</SelectItem>
              <SelectItem value='release'>Release</SelectItem>
              <SelectItem value='editorial'>Editorial</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  )
}
