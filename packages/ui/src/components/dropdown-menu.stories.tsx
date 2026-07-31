import { Button } from './button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './dropdown-menu'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Primitives/Dropdown menu'
}

export function DropdownMenus() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Menus'
        title='Dropdown menu'
        description='Compact action lists for editing and playback flows.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Track actions</CardTitle>
          <CardDescription>Open the trigger to inspect menu placement.</CardDescription>
        </CardHeader>
        <CardContent>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline'>Open menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Track actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Play next</DropdownMenuItem>
              <DropdownMenuItem>Add to queue</DropdownMenuItem>
              <DropdownMenuItem>Copy link</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
    </div>
  )
}
