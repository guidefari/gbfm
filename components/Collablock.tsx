import React from 'react'

interface Props {
  title: string
  children: React.ReactNode
}

export const Collablock: React.FC<Props> = ({ title, children }) => (
  <div className="mb-10">
    <h3 className="flex items-center mb-4 text-lg font-medium text-gray-900 dark:text-white">
      {title}
    </h3>
    <p className="text-gray-500 dark:text-gray-400">{children}</p>
  </div>
)
