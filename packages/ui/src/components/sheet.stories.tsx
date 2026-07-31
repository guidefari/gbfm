import { Button } from './button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from './sheet'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Primitives/Sheet'
}

export function Sheets() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Overlays'
        title='Sheet'
        description='Side panel detail surfaces that preserve page context.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Queue details</CardTitle>
          <CardDescription>Open to inspect sheet layout.</CardDescription>
        </CardHeader>
        <CardContent>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant='outline'>Open sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Queue details</SheetTitle>
                <SheetDescription>
                  Inspect metadata without leaving the review surface.
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </CardContent>
      </Card>
    </div>
  )
}
