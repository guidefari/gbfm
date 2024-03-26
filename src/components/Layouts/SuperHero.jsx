import React from 'react'
import Link from 'next/link'
import { RSS } from '../RSS'

export const SuperHero = () => (
  <section className="pb-8 body-font">
    <div className="container flex flex-col mx-auto lg:px-5 lg:py-10">
      <div className="w-full px-1 pt-4 mb-4 leading-none border-gray-200 sm:mb-0">
        <h1 className="my-0 text-5xl font-bold text-right md:text-8xl xl:text-9xl">
          goosebumps.
          <br />
          <span className="text-highlight">fm</span>
        </h1>
        <div className="w-full text-right">
          <Link href="/words">Words</Link>, <Link href="/micro">Less Words</Link>,{' '}
          <Link href="/labels">Labels</Link>, <Link href="/mixes">Mixes</Link>,{' '}
          <Link href={'/newslater'}>Newsletter</Link>, <RSS />
        </div>
      </div>
    </div>
  </section>
)
