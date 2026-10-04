export const isActiveNavLink = (pathname: string, href: string) =>
  pathname === href ||
  pathname.startsWith(`${href}/`) ||
  (href === '/tweets' && pathname.startsWith('/tweet/'))
