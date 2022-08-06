import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
// import avatar from '/static/images/yo.png'

export const SuperHero = () => {
  return (
    <section className="pb-8 body-font">
      <div className="container flex flex-col mx-auto lg:px-5 lg:py-24">
        <div className="w-full">
          <div className="flex flex-col-reverse lg:flex-row md:mt-10">
            <div className="text-center lg:w-1/3 lg:py-8 lg:pr-8 md:-translate-y-20 md:-translate-x-32 lg:translate-x-0 lg:translate-y-0">
              <Image
                src={'/images/yo.png'}
                alt="avatar"
                width="69px"
                height="69px"
                className="w-48 h-48 rounded-full"
              />
              <div className="flex flex-col items-center justify-center text-center">
                <h2 className="mt-4 text-lg font-medium title-font">Guide Fari</h2>
                <div className="w-12 h-1 mt-2 mb-4 rounded bg-highlight" />
                <p className="max-w-md px-2 mx-auto text-base text-left md:px-6">
                  I love connecting people to new music. One of my favourite ways to spend time is
                  to chat music - say hello, let me know what music you've been enjoying. I may have{' '}
                  <Link href="/curated/ifttt">
                    <span className="italic underline">similar stuff to share</span>
                  </Link>{' '}
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
