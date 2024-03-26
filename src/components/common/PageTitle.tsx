import React from 'react'

type Props = {
  title: string
  description?: string | React.ReactNode
}

export const PageTitle = ({ title, description }: Props) => {
  return (
    <div className="flex flex-col p-3">
      <h2 className="my-0 underline">{title}</h2>
      {description && <p className="max-w-xl">{description}</p>}
    </div>
  )
}
