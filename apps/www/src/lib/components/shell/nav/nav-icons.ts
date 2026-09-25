import {
  Disc3,
  Headphones,
  House,
  LayoutDashboard,
  Mail,
  MessageSquare,
  MonitorPlay,
  Newspaper,
  Radio,
  Tag,
  Upload,
} from 'lucide-svelte'

import type { NavIcon } from './nav-config'

export const navIcons = {
  home: House,
  radio: Radio,
  disc: Disc3,
  newspaper: Newspaper,
  message: MessageSquare,
  tag: Tag,
  headphones: Headphones,
  dashboard: LayoutDashboard,
  upload: Upload,
  mail: Mail,
  youtube: MonitorPlay,
} satisfies Record<NavIcon, typeof House>
