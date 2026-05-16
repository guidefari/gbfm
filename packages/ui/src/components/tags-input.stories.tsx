import { useState } from 'react'
import { TagsInput } from './tags-input'
import { StoryPanelHeader, storyPanelClassName } from './story-helpers'

export default {
  title: '@gbfm/ui/TagsInput'
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
      <div className='max-w-md space-y-6'>
        <TagsInput
          tags={tags}
          onAddTag={(tag) => setTags((prev) => [...prev, tag])}
          onRemoveTag={(tag) =>
            setTags((prev) => prev.filter((t) => t !== tag))
          }
          contentTypeLabel='mix'
        />
        <TagsInput
          tags={[]}
          onAddTag={() => {}}
          onRemoveTag={() => {}}
          contentTypeLabel='show'
        />
      </div>
    </div>
  )
}
