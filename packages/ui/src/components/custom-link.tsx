import type { ReactNode } from 'react'

type CustomLinkProps = {
  children: ReactNode | string
  className?: string
  href: string
  target?: string
  rel?: string
}

export default function CustomLink({
  href,
  children,
  className,
  target,
  rel
}: CustomLinkProps) {
  return (
    <a href={href} className={className} target={target} rel={rel}>
      {children}
    </a>
  )
}
