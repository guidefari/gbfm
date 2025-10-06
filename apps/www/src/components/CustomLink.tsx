type Props = {
  children: React.ReactNode | string
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
}: Props) {
  return (
    <a href={href} className={className} target={target} rel={rel}>
      {children}
    </a>
  )
}
