import Link, { LinkProps } from 'next/link'

type Props = {
  children: React.ReactNode
} & LinkProps

export default function CustomLink({ as, href, children, ...otherProps }: Props) {
  return (
    <Link as={as} href={href} {...otherProps}>
      {children}
    </Link>
  )
}
