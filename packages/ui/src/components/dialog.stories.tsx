import { Button } from './button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './dialog'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Primitives/Dialog'
}

export function Dialogs() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Overlays'
        title='Dialog'
        description='Modal confirmation and focused detail surfaces.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Confirmation</CardTitle>
          <CardDescription>Open to inspect focus and portal behavior.</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant='outline'>Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish draft?</DialogTitle>
                <DialogDescription>
                  This confirms the editorial item is ready for review.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}
