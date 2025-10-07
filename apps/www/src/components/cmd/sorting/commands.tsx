import { ArrowDownAZ, ArrowUpAZ, Calendar } from 'lucide-react'
import { CommandItem, CommandShortcut } from '@/components/ui/command'

interface SortingCommandsProps {
  sortBy: 'date' | 'title'
  sortOrder: 'asc' | 'desc'
  onSortByDate: () => void
  onSortByTitle: () => void
  onToggleSortOrder: () => void
}

export const SortingCommands = ({
  sortBy,
  sortOrder,
  onSortByDate,
  onSortByTitle,
  onToggleSortOrder
}: SortingCommandsProps) => {
  return (
    <>
      <CommandItem onSelect={onSortByDate}>
        <Calendar />
        <span>Sort by Date Created</span>
        {sortBy === 'date' && <CommandShortcut>✓</CommandShortcut>}
      </CommandItem>
      <CommandItem onSelect={onSortByTitle}>
        <ArrowDownAZ />
        <span>Sort by Title</span>
        {sortBy === 'title' && <CommandShortcut>✓</CommandShortcut>}
      </CommandItem>
      <CommandItem onSelect={onToggleSortOrder}>
        {sortOrder === 'asc' ? <ArrowUpAZ /> : <ArrowDownAZ />}
        <span>Toggle Sort Order ({sortOrder === 'asc' ? 'A-Z' : 'Z-A'})</span>
        <CommandShortcut>⌥S</CommandShortcut>
      </CommandItem>
    </>
  )
}
