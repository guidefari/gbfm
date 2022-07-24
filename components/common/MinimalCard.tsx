import { Link } from "@remix-run/react"
import React from "react"

interface Props {
  title: string
  blurb: string
  imageUrl: string
  slug?: string
}

export const MinimalCard: React.FC<Props> = ({
  title,
  blurb,
  imageUrl,
  slug,
}) => {
  return (
    <div className="flex-shrink-0 sm:flex lg:items-start group">
      <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
        <Link to={slug as string}>
          <img
            className="object-cover max-w-xs rounded-md aspect-square"
            src={imageUrl}
            alt={title}
          />
        </Link>
      </div>
      <div>
        <span className="text-sm ">Genres</span>
        <p className="mt-3 text-lg font-medium leading-6">
          <Link
            to={slug as string}
            className="text-xl text-indigo-900 hover:text-indigo-700"
          >
            {title || ""}
          </Link>
        </p>
        <p className="mt-2 leading-normal text-blue-100 text">{blurb || ""}</p>
      </div>
    </div>
  )
}
