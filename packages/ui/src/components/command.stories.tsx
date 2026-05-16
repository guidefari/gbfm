import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from './card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from './command'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Command'
}

export function Commands() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Menus'
        title='Command'
        description='Search-style command surface for keyboard-driven flows.'
      />
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Filterable command list surface.</CardDescription>
        </CardHeader>
        <CardContent>
          <Command className='rounded-sm border'>
            <CommandInput placeholder='Search commands...' />
            <CommandList>
              <CommandEmpty>No command found.</CommandEmpty>
              <CommandGroup heading='Actions'>
                <CommandItem>Upload mix</CommandItem>
                <CommandItem>Create label</CommandItem>
                <CommandItem>Open queue</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </CardContent>
      </Card>
    </div>
  )
}
