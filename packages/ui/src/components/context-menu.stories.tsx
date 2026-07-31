import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from './context-menu'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/Primitives/Context menu'
}

export function ContextMenus() {
  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Overlay'
        title='ContextMenu'
        description='Right-click menu for contextual actions on items.'
      />
      <div className='flex items-center justify-center h-40 border border-dashed border-border rounded-sm'>
        <ContextMenu>
          <ContextMenuTrigger className='px-6 py-3 border border-border rounded-sm text-sm text-muted-foreground select-none'>
            Right-click me
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel>Mix actions</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem>
              Play <ContextMenuShortcut>⌘P</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              Add to queue <ContextMenuShortcut>⌘Q</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuCheckboxItem checked>Show in library</ContextMenuCheckboxItem>
            <ContextMenuCheckboxItem>Download</ContextMenuCheckboxItem>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>Share</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem>Copy link</ContextMenuItem>
                <ContextMenuItem>Share to profile</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem className='text-destructive'>Delete</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>
  )
}
