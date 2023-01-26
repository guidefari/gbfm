import React from 'react'
import { Root, Viewport, Corner, Scrollbar, Thumb } from '@radix-ui/react-scroll-area'

const HorizontalScrollCards = ({ children }) => {
  return (
    <Root className="w-full shadow-sm ScrollAreaRoot">
      <Viewport>
        <div className="flex h-full space-x-8">{children}</div>
        <Scrollbar orientation="horizontal">
          <Thumb />
        </Scrollbar>
        <Corner />
      </Viewport>
    </Root>
  )
}

export default HorizontalScrollCards
