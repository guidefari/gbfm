import React from 'react'

type Props = {
  title: string
  description?: string
}

export const PageTitle = ({ title, description }: Props) => {
  return (
    <div className="flex flex-col py-5 border-b-2 md:items-center md:flex-row">
      <h2 className="my-0 ">{title}</h2>
      {description && <p className="max-w-xl px-4">{description}</p>}
    </div>
  )
}
