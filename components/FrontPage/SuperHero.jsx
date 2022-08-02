import Image from 'next/image'
import React from 'react'
// import avatar from '/static/images/yo.png'

export const SuperHero = () => {
  return (
    <section className=" body-font">
      <div className="container flex flex-col mx-auto lg:px-5 lg:py-24">
        <div className="mx-auto">
          <div className="flex flex-col-reverse sm:flex-row md:mt-10">
            <div className="text-center sm:w-1/3 sm:py-8 sm:pr-8">
              <Image
                src={'/images/yo.png'}
                alt="avatar"
                width="69px"
                height="69px"
                className="w-48 h-48 rounded-full"
              />
              <div className="flex flex-col items-center justify-center text-center">
                <h2 className="mt-4 text-lg font-medium title-font">Guide Fari</h2>
                <div className="w-12 h-1 mt-2 mb-4 bg-indigo-500 rounded" />
                <p className="text-base text-left">
                  I love connecting people to new music. One of my favourite ways to spend time is
                  to chat music - say hello, let me know what music you've been enjoying. I may have
                  similar stuff to share 🙂
                </p>
              </div>
            </div>
            <div className="pt-4 mb-4 text-center border-gray-200 sm:mb-0 sm:w-2/3 sm:border-l sm:py-8 sm:pl-8 sm:text-left">
              <h1 className="mb-0 text-5xl font-bold leading-none text-right md:text-6xl lg:text-8xl xl:text-9xl">
                goosebumps.
                <br />
                <span style={{ color: '#9BFD9E' }}>fm</span>
              </h1>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
