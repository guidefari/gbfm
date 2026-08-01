import { useState } from 'react'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'
import { TagsInput } from './tags-input'

export default {
  title: '@gbfm/ui/Forms/Tags input'
}

export function Tags() {
  const [tags, setTags] = useState(['dub', 'leftfield', 'club'])

  return (
    <div className={storyPanelClassName}>
      <StoryPanelHeader
        eyebrow='Form'
        title='TagsInput'
        description='Add and remove tags. Press Enter or click Add.'
      />
      <div className='max-w-md space-y-8'>
        <TagsInput
          tags={tags}
          onAddTag={(tag) => setTags((prev) => [...prev, tag])}
          onRemoveTag={(tag) => setTags((prev) => prev.filter((t) => t !== tag))}
          contentTypeLabel='mix'
        />
        <TagsInput tags={[]} onAddTag={() => {}} onRemoveTag={() => {}} contentTypeLabel='show' />
      </div>
    </div>
  )
}
