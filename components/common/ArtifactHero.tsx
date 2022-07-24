import React from "react"

interface Props {
  title: string
  description?: string
}

export const ArtifactHero: React.FC<Props> = ({ title, description }) => {
  return (
    <section className="text-blue-100">
      <div className="px-4 py-12 mx-auto max-w-7xl sm:px-6 md:px-12 lg:px-24 lg:py-24">
        <div className="flex flex-col w-full mb-12 text-left">
          <h1 className="max-w-5xl text-2xl font-bold leading-none tracking-tighter text-blue-100 md:text-5xl lg:text-6xl lg:max-w-7xl">
            {title}
          </h1>
          <p className="max-w-xl mt-8 text-base leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </section>
  )
}
