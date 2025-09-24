import { Edit } from 'lucide-react'
import { CommandItem, CommandShortcut } from '@/components/ui/command'

interface ContentCommandsProps {
  canEdit: boolean
  onEditContent: () => void
}

export const ContentCommands = ({
  canEdit,
  onEditContent
}: ContentCommandsProps) => {
  if (!canEdit) return null

  return (
    <CommandItem onSelect={onEditContent}>
      <Edit />
      <span>Edit This Content</span>
      <CommandShortcut>E</CommandShortcut>
    </CommandItem>
  )
}
