import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from './card'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

export default {
  title: '@gbfm/ui/Tabs'
}

export function TabSet() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Structure'
        title='Tabs'
        description='Switch between related panels without leaving context.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Editorial workflow</CardTitle>
          <CardDescription>Queue, history, and draft states.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue='queue'>
            <TabsList>
              <TabsTrigger value='queue'>Queue</TabsTrigger>
              <TabsTrigger value='history'>History</TabsTrigger>
              <TabsTrigger value='drafts'>Drafts</TabsTrigger>
            </TabsList>
            <TabsContent value='queue'>
              Upcoming reviewed tracks and mixes.
            </TabsContent>
            <TabsContent value='history'>
              Recently published catalog updates.
            </TabsContent>
            <TabsContent value='drafts'>
              Unfinished notes and uploads.
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
