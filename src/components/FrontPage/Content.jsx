import Image from 'next/image'
import CustomLink from '../CustomLink'
import Link from 'next/link'

// Pixel GIF code adapted from https://stackoverflow.com/a/33919020/266535
const keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='

const triplet = (e1, e2, e3) =>
  keyStr.charAt(e1 >> 2) +
  keyStr.charAt(((e1 & 3) << 4) | (e2 >> 4)) +
  keyStr.charAt(((e2 & 15) << 2) | (e3 >> 6)) +
  keyStr.charAt(e3 & 63)

const rgbDataURL = (r, g, b) =>
  `data:image/gif;base64,R0lGODlhAQABAPAA${
    triplet(0, r, g) + triplet(b, 255, 255)
  }/yH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==`

export const Content = () => {
  return (
    <div className="px-4 py-16 mx-auto sm:max-w-xl md:max-w-full lg:max-w-screen-xl md:px-24 lg:px-8 lg:py-20">
      <div className="grid gap-4 row-gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between p-5 border rounded shadow-sm">
          <div>
            <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-indigo-50">
              <svg
                className="w-12 h-12 text-deep-purple-accent-400"
                stroke="currentColor"
                viewBox="0 0 52 52"
              >
                <polygon
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  points="29 13 14 29 25 29 23 39 38 23 27 23"
                />
              </svg>
            </div>
            <h6 className="mb-2 font-semibold leading-5">How to use this site</h6>
            <p className="mb-3 text-sm">
              Firstly, some house keeping. This site has a few experimental components to it.
            </p>
          </div>
          <CustomLink href="curated/how-to" as="curated/how-to">
            Learn more
          </CustomLink>
        </div>
        <div className="flex flex-col justify-between p-5 border rounded shadow-sm">
          <div>
            <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-indigo-50">
              <svg
                className="w-12 h-12 text-deep-purple-accent-400"
                stroke="currentColor"
                viewBox="0 0 52 52"
              >
                <polygon
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  points="29 13 14 29 25 29 23 39 38 23 27 23"
                />
              </svg>
            </div>
            <h6 className="mb-2 font-semibold leading-5">Mixes, Playlists, & Words</h6>
            <p className="mb-3 text-sm text-gray-900">
              Rough pomfret lemon shark plownose chimaera southern sandfish kokanee northern sea.
            </p>
          </div>
          <CustomLink href="/curated" as="/curated">
            Learn more
          </CustomLink>
        </div>
        <div className="flex flex-col justify-between p-5 border rounded shadow-sm">
          <div>
            <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-indigo-50">
              <svg
                className="w-12 h-12 text-deep-purple-accent-400"
                stroke="currentColor"
                viewBox="0 0 52 52"
              >
                <polygon
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  points="29 13 14 29 25 29 23 39 38 23 27 23"
                />
              </svg>
            </div>
            <h6 className="mb-2 font-semibold leading-5">Micro Posts</h6>
            <p className="mb-3 text-sm text-gray-900">
              A slice of heaven. O for awesome, this chocka full cuzzie is as rip-off as a cracker.
            </p>
          </div>
          <CustomLink href="micro" as="micro">
            Learn more
          </CustomLink>
        </div>
        <div className="flex flex-col justify-between p-5 border rounded shadow-sm">
          <div>
            <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-indigo-50">
              <Link href="authors/guide">
                <Image
                  src="/images/yo.png"
                  placeholder="blur"
                  blurDataURL={rgbDataURL(129, 195, 215)}
                  alt="avatar"
                  width={69}
                  height={69}
                  className="mx-auto rounded-full "
                />
              </Link>
            </div>
            <h6 className="mb-2 font-semibold leading-5">A slice of heaven</h6>
            <p className="mb-3 text-sm text-gray-900">
              I love connecting people to new music. One of my favourite ways to spend time is to
              chat music - say hello, let me know what music you've been enjoying. I may have{' '}
              <CustomLink href="/curated/ifttt">
                <span>similar stuff to share</span>
              </CustomLink>{' '}
              🙂
              <br />
              Interested in <CustomLink href="collaborate">collaborative works</CustomLink>?
            </p>
          </div>
          <a
            href="/"
            aria-label=""
            className="inline-flex items-center font-semibold transition-colors duration-200 text-deep-purple-accent-400 hover:text-deep-purple-800"
          >
            Learn more
          </a>
        </div>
      </div>
    </div>
  )
}
