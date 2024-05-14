import { useRouter } from 'next/router'
import { useState } from 'react'
import { FaSquareRss } from 'react-icons/fa6'
import * as Sentry from '@sentry/nextjs'

export const RSS = () => {
  const [isCopied, setIsCopied] = useState(false)
  const { basePath } = useRouter()
  const BASS = basePath ? basePath : 'https://goosebumps.fm'
  const RSSurl = new URL(`${BASS}/rss.xml`).toString()

  const handleCopyToClipboard = () => {
    try {
      navigator.clipboard.writeText(RSSurl)
      setIsCopied(true)
      setTimeout(() => {
        setIsCopied(false)
      }, 3500)
    } catch (error) {
      Sentry.captureException(error)
      console.error('Failed to copy to clipboard', error)
    }
  }

  return (
    <div title="Copy RSS link to clipboard" className="inline-block text-orange-300">
      {!isCopied && <FaSquareRss onClick={handleCopyToClipboard} className=" cursor-pointer" />}
      {isCopied && (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="inline w-7 h-7 "
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs">RSS link copied to clipboard</span>
        </>
      )}
    </div>
  )
}
