import { Disc3, Mail, MessageSquare, Newspaper, Radio, Rss, Tag } from 'lucide-svelte'

import type { NavIcon } from './nav-config'
import YoutubeIcon from './YoutubeIcon.svelte'

export const navIcons = {
  radio: Radio,
  disc: Disc3,
  newspaper: Newspaper,
  message: MessageSquare,
  tag: Tag,
  mail: Mail,
  rss: Rss,
  youtube: YoutubeIcon,
} satisfies Record<NavIcon, typeof Radio | typeof YoutubeIcon>
