import Image from "next/image"
import React from "react"
// import avatar from '/static/images/yo.png'

export const SuperHero = () => {
  return (
    <section className=" body-font ">
      <div className="container flex flex-col px-5 py-24 mx-auto">
        <div className="mx-auto lg:w-4/6">
          <div className="tracking-tighter rounded-lg ">
            <h1 className="mb-0 text-3xl font-bold leading-none text-right md:text-6xl lg:text-9xl">
              goosebumps.
              <br className="hidden lg:block" />
              <span style={{ color: "#9BFD9E" }}>fm</span>
            </h1>
          </div>
          <div className="flex flex-col mt-10 sm:flex-row">
            <div className="text-center sm:w-1/3 sm:py-8 sm:pr-8">
            <Image
              src={'/static/images/yo.png'}
              alt="avatar"
              width="69px"
              height="69px"
              className="h-48 w-48 rounded-full"
            />
              <div className="flex flex-col items-center justify-center text-center">
                <h2 className="mt-4 text-lg font-medium title-font">
                  Guide Fari
                </h2>
                <div className="w-12 h-1 mt-2 mb-4 bg-indigo-500 rounded" />
                <p className="text-base text-left">
                  I love connecting people to new music. One of my favourite
                  ways to spend time is to chat music - say hello, let me know
                  what music you've been enjoying. I may have similar stuff to
                  share 🙂
                </p>
              </div>
            </div>
            <div className="pt-4 mt-4 text-center border-t border-gray-200 sm:mt-0 sm:w-2/3 sm:border-l sm:border-t-0 sm:py-8 sm:pl-8 sm:text-left">
              <p className="mb-4 text-lg leading-relaxed">
                Meggings portland fingerstache lyft, post-ironic fixie man bun
                banh mi umami everyday carry hexagon locavore direct trade art
                party. Locavore small batch listicle gastropub farm-to-table
                lumbersexual salvia messenger bag. Coloring book flannel
                truffaut craft beer drinking vinegar sartorial, disrupt fashion
                axe normcore meh butcher. Portland 90's scenester vexillologist
                forage post-ironic asymmetrical, chartreuse disrupt butcher
                paleo intelligentsia pabst before they sold out four loko. 3
                wolf moon brooklyn.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
