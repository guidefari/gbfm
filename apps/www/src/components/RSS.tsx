'use client'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@gbfm/ui'
import { CheckIcon } from '@radix-ui/react-icons'
import { Rss } from 'lucide-react'
import { useState } from 'react'
import { publicUrlObj } from '@/lib/http'
import { log } from '@/services/logger'

export const RSS = () => {
  const [isCopied, setIsCopied] = useState(false)
  const RSSurl = publicUrlObj('/rss.xml').toString()

  const toggleIsCopiedForThreeSeconds = () => {
    setIsCopied(true)
    setTimeout(() => {
      setIsCopied(false)
    }, 1234)
  }

  const handleCopyToClipboard = () => {
    try {
      void navigator.clipboard.writeText(RSSurl)
      toggleIsCopiedForThreeSeconds()
    } catch (error) {
      log('error', 'Failed to copy RSS link to clipboard', { error })
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type='button'
            onClick={handleCopyToClipboard}
            className='flex items-center justify-center transition-colors rounded-sm h-9 w-9 text-foreground hover:text-highlight md:h-8 md:w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0'>
            {isCopied ? <CheckIcon className='w-5 h-5' /> : <Rss className='w-5 h-5' />}
          </button>
        </TooltipTrigger>
        <TooltipContent side='right'>
          {isCopied ? 'RSS link copied to clipboard' : 'Copy RSS link to clipboard'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
