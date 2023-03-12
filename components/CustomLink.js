import Link from 'next/link'

export default function CustomLink({ as, href, children, ...otherProps }) {
  return (
    <Link as={as} href={href} {...otherProps}>
      {children}
    </Link>
  )
}
