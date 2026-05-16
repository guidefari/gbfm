import type React from 'react'

type SectionProps = {
  title: string
  children: React.ReactNode
}

export function Section({ title, children }: SectionProps) {
  return (
    <section>
      <h2 className='my-3 text-2xl md:text-4xl'>{title}</h2>
      {children}
    </section>
  )
}
