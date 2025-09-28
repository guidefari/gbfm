import React from 'react'

export interface CommandAction {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onSelect: () => void
  shortcut?: string
  description?: string
}

export interface CommandSection {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  requiresAuth?: boolean
  type: 'section' // Has sub-items
  items: CommandAction[]
}

export interface CommandTile {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  requiresAuth?: boolean
  type: 'action' // Direct action
  onSelect: () => void
}

export type CommandItem = CommandSection | CommandTile

export interface CommandContext {
  activeSection: CommandSection | null
  searchValue: string
  breadcrumb: string[]
}
