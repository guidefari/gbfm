import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import CustomLink from '../CustomLink'
// import avatar from '/static/images/yo.png'

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

export const SuperHero = () => {
  return (
    <section className="pb-8 body-font">
      <div className="container flex flex-col mx-auto lg:px-5 lg:py-24">
        <div className="w-full">
          <div className="flex flex-col-reverse lg:flex-row md:mt-10">
            <div className="text-center lg:w-1/3 lg:py-8 lg:pr-8 md:-translate-y-20 md:-translate-x-32 lg:translate-x-0 lg:translate-y-0 ">
              <Image
                src={'/images/yo.png'}
                placeholder="blur"
                blurDataURL={rgbDataURL(129, 195, 215)}
                alt="avatar"
                width={69}
                height={69}
                className="w-48 h-48 rounded-full"
              />
              <div className="flex flex-col items-center justify-center text-center">
                <h2 className="mt-4 text-lg font-medium title-font">
                  <CustomLink href={'/author/guide'}>
                    <span>Guide Fari</span>
                  </CustomLink>
                </h2>

                <div className="w-12 h-1 mt-2 mb-4 rounded bg-highlight" />
                <p className="max-w-md px-2 mx-auto text-base text-left md:px-6">
                  I love connecting people to new music. One of my favourite ways to spend time is
                  to chat music - say hello, let me know what music you've been enjoying. I may have{' '}
                  <CustomLink href="/curated/ifttt">
                    <span>similar stuff to share</span>
                  </CustomLink>{' '}
                  🙂
                </p>
              </div>
            </div>
            <div className="pt-4 mb-4 border-gray-200 sm:mb-0 lg:border-l sm:py-8 sm:pl-8 ">
              <h1 className="mb-0 text-6xl font-bold leading-none text-right md:text-8xl xl:text-9xl">
                goosebumps.
                <br />
                <span className="text-highlight">fm</span>
              </h1>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
