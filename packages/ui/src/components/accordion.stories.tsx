import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from './accordion'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from './card'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Accordion'
}

export function Accordions() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Disclosure'
        title='Accordion'
        description='Stacked disclosure for progressive detail.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Theme notes</CardTitle>
          <CardDescription>Single-open accordion behavior.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type='single' collapsible defaultValue='tokens'>
            <AccordionItem value='tokens'>
              <AccordionTrigger>Theme tokens</AccordionTrigger>
              <AccordionContent>
                Semantic colors should carry each theme without component
                rewrites.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value='viewport'>
              <AccordionTrigger>Viewport review</AccordionTrigger>
              <AccordionContent>
                Use Ladle viewport tools to exercise breakpoint behavior.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
