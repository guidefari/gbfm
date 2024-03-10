import React from 'react'
import dynamic from 'next/dynamic'
// import { Example } from '../components/Editor'
// import { GetServerSideProps } from 'next'

const Editor = dynamic(() => import('../components/Editor'), { ssr: false })
// const Example = dynamic(() => import('../components/Editor'), { ssr: false })

export default function Plusless() {
  return (
    <>
      <Editor />
      {/* <Example /> */}
    </>
  )
}
