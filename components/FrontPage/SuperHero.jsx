import Image from 'next/image'
import React from 'react'
// import avatar from '/static/images/yo.png'

export const SuperHero = () => {
  return (
    <section className=" body-font">
      <div className="container mx-auto flex flex-col lg:px-5 lg:py-24">
        <div className="mx-auto">
          <div className="mt-10 flex flex-col sm:flex-row">
            <div className="text-center sm:w-1/3 sm:py-8 sm:pr-8">
              <Image
                src={'/static/images/yo.png'}
                alt="avatar"
                width="69px"
                height="69px"
                className="h-48 w-48 rounded-full"
              />
              <div className="flex flex-col items-center justify-center text-center">
                <h2 className="title-font mt-4 text-lg font-medium">Guide Fari</h2>
                <div className="mt-2 mb-4 h-1 w-12 rounded bg-indigo-500" />
                <p className="text-left text-base">
                  I love connecting people to new music. One of my favourite ways to spend time is
                  to chat music - say hello, let me know what music you've been enjoying. I may have
                  similar stuff to share 🙂
                </p>
              </div>
            </div>
            <div className="mt-4 border-t border-gray-200 pt-4 text-center sm:mt-0 sm:w-2/3 sm:border-l sm:border-t-0 sm:py-8 sm:pl-8 sm:text-left">
              <h1 className="mb-0 text-right text-5xl font-bold leading-none md:text-8xl lg:text-9xl">
                goosebumps.
                <br className="hidden md:block" />
                <span style={{ color: '#9BFD9E' }}>fm</span>
              </h1>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
