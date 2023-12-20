import Link, { LinkProps } from 'next/link'

type Props = {
  children: React.ReactNode
  className?: string
} & LinkProps

export default function CustomLink({ as, href, children, className, ...otherProps }: Props) {
  return (
    <Link as={as} href={href} className={className} {...otherProps}>
      {children}
    </Link>
  )
}
