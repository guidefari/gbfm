import { Button } from '@gbfm/ui'
import { Music, Video } from 'lucide-react'
import { useState } from 'react'
import { MDXRendrr } from './MDXRendrr'
import { ReactMde } from './react-mde'
import 'react-mde/lib/styles/css/react-mde-toolbar.css'
import 'react-mde/lib/styles/css/react-mde.css'
import 'react-mde/lib/styles/css/react-mde-editor.css'
import './editor.css'
import { compile } from '@mdx-js/mdx'

interface SimpleMarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SimpleMarkdownEditor({
  value,
  onChange,
  placeholder
}: SimpleMarkdownEditorProps) {
  const [selectedTab, setSelectedTab] = useState<'write' | 'preview'>('write')

  const save = async function* () {
    // Simple placeholder for image uploads
    const wait = (time: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, time)
      })

    await wait(1000)
    yield 'https://picsum.photos/300'
    await wait(1000)
    return true
  }

  const insertEmbed = (type: string) => {
    let embedCode = ''
    switch (type) {
      case 'bandcamp':
        embedCode = `\n<iframe style={{ border: 0, width: "350px", height: "470px" }} src="https://bandcamp.com/EmbeddedPlayer/album=ALBUM_ID/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/transparent=true/" seamless></iframe>\n\n`
        break
      case 'spotify':
        embedCode = `\n<iframe src="https://open.spotify.com/embed/track/TRACK_ID" width="100%" height="352" frameBorder="0" allowFullScreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>\n\n`
        break
      case 'youtube':
        embedCode = `\n<iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID" title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen></iframe>\n\n`
        break
      case 'soundcloud':
        embedCode = `\n<iframe width="100%" height="166" scrolling="no" frameBorder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/TRACK_ID&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true"></iframe>\n\n`
        break
    }
    onChange(value + embedCode)
  }

  return (
    <div className='space-y-4'>
      {/* Embed Buttons */}
      <div className='flex flex-wrap gap-2 p-3 rounded-sm border bg-gb-bg border-gb-pastel-green-2/20'>
        <div className='flex gap-1 items-center'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => insertEmbed('spotify')}
            className='text-gb-default-text hover:text-gb-highlight hover:bg-gb-pastel-green-2/20'>
            <Music className='w-4 h-4' />
            <span className='ml-1 text-xs'>Spotify</span>
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => insertEmbed('soundcloud')}
            className='text-gb-default-text hover:text-gb-highlight hover:bg-gb-pastel-green-2/20'>
            <Music className='w-4 h-4' />
            <span className='ml-1 text-xs'>SoundCloud</span>
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => insertEmbed('bandcamp')}
            className='text-gb-default-text hover:text-gb-highlight hover:bg-gb-pastel-green-2/20'>
            <Music className='w-4 h-4' />
            <span className='ml-1 text-xs'>Bandcamp</span>
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => insertEmbed('youtube')}
            className='text-gb-default-text hover:text-gb-highlight hover:bg-gb-pastel-green-2/20'>
            <Video className='w-4 h-4' />
            <span className='ml-1 text-xs'>YouTube</span>
          </Button>
        </div>
      </div>

      <ReactMde
        value={value}
        onChange={onChange}
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
        generateMarkdownPreview={async (markdown) => {
          if (!markdown.trim()) {
            return Promise.resolve(
              <div className='p-6 italic text-center text-gb-default-text/50'>
                Nothing to preview yet. Start writing in the Edit tab.
              </div>
            )
          }
          const compiled = await compileMdx(markdown)
          return Promise.resolve(<MDXRendrr mdxString={compiled} />)
        }}
        childProps={{
          writeButton: {
            tabIndex: -1
          },
          previewButton: {},
          textArea: {
            placeholder: placeholder
          }
        }}
        paste={{
          saveImage: save
        }}
        classes={{
          textArea:
            'focus:outline-none bg-transparent label:rounded-sm min-h-[80dvh] h-full',
          toolbar: 'bg-transparent border-none',
          reactMde: 'focus:outline-none border-none'
        }}
        toolbarCommands={[
          ['header', 'bold', 'italic', 'strikethrough'],
          ['link', 'quote', 'code', 'image'],
          ['unordered-list', 'ordered-list', 'checked-list']
        ]}
      />
    </div>
  )
}

async function compileMdx(markdown: string) {
  try {
    const compiled = await compile(markdown, {
      outputFormat: 'function-body'
    })
    return compiled.toString()
  } catch (error) {
    console.error('MDX compilation error:', error)
    return markdown // Return original markdown if compilation fails
  }
}
