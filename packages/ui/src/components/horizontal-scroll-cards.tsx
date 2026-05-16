import {
  Corner,
  Root,
  Scrollbar,
  Thumb,
  Viewport
} from '@radix-ui/react-scroll-area'
import type React from 'react'

type HorizontalScrollCardsProps = {
  children: React.ReactNode
}

export function HorizontalScrollCards({
  children
}: HorizontalScrollCardsProps) {
  return (
    <Root className='shadow-sm shadooo '>
      <Viewport className='w-full'>
        <div className='flex space-x-8 '>{children}</div>
        <Scrollbar orientation='horizontal'>
          <Thumb />
        </Scrollbar>
        <Corner />
      </Viewport>
    </Root>
  )
}

export default HorizontalScrollCards
