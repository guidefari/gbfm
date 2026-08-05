import type { SVGProps } from 'react'

export const GoosebumpsLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 32 32' fill='none' aria-hidden='true' {...props}>
    <circle cx='16' cy='16' r='14.25' stroke='currentColor' strokeWidth='1.5' opacity='0.45' />
    <path
      d='M16 5.5a10.5 10.5 0 1 1 -9.1 5.25'
      stroke='currentColor'
      strokeWidth='2.5'
      strokeLinecap='round'
    />
    <circle cx='16' cy='16' r='4.75' fill='currentColor' />
  </svg>
)
