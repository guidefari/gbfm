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
    <section className="w-full px-4 py-16 mx-auto md:px-24 lg:px-8 lg:py-20">
      <div className="grid gap-4 row-gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col justify-between p-5 border rounded shadow-sm">
          <div>
            <h6 className="mb-2 font-semibold leading-5">
              <CustomLink href="curated/how-to" as="curated/how-to">
                👀 How to use this site
              </CustomLink>
            </h6>
            <p className="mb-3 text-sm">
              Firstly, some house keeping. This site has a few experimental components to it.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between p-5 border rounded shadow-sm">
          <div>
            <h6 className="mb-2 font-semibold leading-5">What kind of content is on here?</h6>
            <p className="mb-3 text-sm">
              <CustomLink href="#mixes">Mixes</CustomLink>, tweet-like{' '}
              <CustomLink href="micro">micro-posts</CustomLink>,{' '}
              <CustomLink href="#words">full-length posts, playlists</CustomLink>, and{' '}
              <CustomLink href="labels">record label round-ups</CustomLink>.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between p-5 border rounded shadow-sm">
          <div>
            <h6 className="mb-2 font-semibold leading-5">Community effort</h6>
            <p className="mb-3 text-sm">
              The idea behind this site is to build it as a{' '}
              <CustomLink href="collaborate">community effort</CustomLink>. UI/UX feedback, track
              suggestions, guest mixes, illustrations, you name it.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
