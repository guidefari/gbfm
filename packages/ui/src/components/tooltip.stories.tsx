import { Button } from './button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from './card'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './tooltip'

export default {
  title: '@gbfm/ui/Tooltip'
}

export function Tooltips() {
  return (
    <TooltipProvider>
      <div className={storyPanelClassName}>
        <StoryPanelHeader
          eyebrow='Overlays'
          title='Tooltip'
          description='Small contextual hints for dense controls.'
        />
        <Card>
          <CardHeader>
            <CardTitle>Hint</CardTitle>
            <CardDescription>Hover or focus the trigger.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant='ghost'>Tooltip</Button>
              </TooltipTrigger>
              <TooltipContent>Useful for dense controls.</TooltipContent>
            </Tooltip>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
