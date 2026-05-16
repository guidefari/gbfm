import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from './card'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'
import { Toast, ToastDescription, ToastProvider, ToastTitle } from './toast'

export default {
  title: '@gbfm/ui/Toast'
}

export function Toasts() {
  return (
    <ToastProvider>
      <div className={storyPanelClassName}>
        <StoryPanelHeader
          eyebrow='Overlays'
          title='Toast'
          description='Feedback surface for transient status messages.'
        />
        <Card>
          <CardHeader>
            <CardTitle>Static preview</CardTitle>
            <CardDescription>
              Toast layout without dispatch wiring.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Toast className='max-w-md'>
              <div className='grid gap-1'>
                <ToastTitle>Toast preview</ToastTitle>
                <ToastDescription>
                  Static feedback surface for visual review.
                </ToastDescription>
              </div>
            </Toast>
          </CardContent>
        </Card>
      </div>
    </ToastProvider>
  )
}
