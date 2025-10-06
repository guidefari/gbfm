import { MDXArchiveTypes } from '@gbfm/core/mdx/mdx.types'

export const ArchetypesLinks = () => {
  return (
    <ul>
      {MDXArchiveTypes.archetypeSchema.options.map((archetype) => (
        <li key={archetype}>
          <a href={`/${archetype}`}>{archetype}</a>
        </li>
      ))}
    </ul>
  )
}
