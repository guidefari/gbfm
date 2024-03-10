import '@mdxeditor/editor/style.css'
import {
  MDXEditor,
  UndoRedo,
  toolbarPlugin,
  MDXEditorMethods,
  InsertFrontmatter,
  frontmatterPlugin,
  usePublisher,
  insertJsx$,
  JsxComponentDescriptor,
  GenericJsxEditor,
  jsxPlugin,
} from '@mdxeditor/editor'
import { useRef } from 'react'

const SpotifyEmbeds = ['Track', 'Album', 'Playlist'] as const

const jsxComponentDescriptors: JsxComponentDescriptor[] = [
  ...SpotifyEmbeds.map((name) => ({
    name,
    kind: 'text' as const, // 'text' for inline, 'flow' for block
    props: [{ name: 'url', type: 'string' as const }],
    Editor: GenericJsxEditor,
  })),
]

const EmbedSpotifyJSX = () => {
  const insertJsx = usePublisher(insertJsx$)

  const clickHandler = (name: 'Album' | 'Track' | 'Playlist') => {
    insertJsx({
      name,
      kind: 'text',
      props: { url: '' },
    })
  }

  return (
    <>
      <button onClick={() => clickHandler('Track')}>Track</button>
      <button onClick={() => clickHandler('Album')}>Album</button>
      <button onClick={() => clickHandler('Playlist')}>Playlist</button>
    </>
  )
}

const jsxMarkdown = `

this is a cool markdown
`

export const Example = () => {
  const ref = useRef<MDXEditorMethods>(null)

  return (
    <section className="w-full max-w-4xl mx-auto border-y-gb-pastel-green-2 border-y-2 md:w-3/4">
      <MDXEditor
        className="w-full rounded-lg min-h-56 overrides"
        ref={ref}
        markdown={''} // the contents of the file  below
        onChange={() => console.log(ref?.current?.getMarkdown())}
        plugins={[
          frontmatterPlugin({ slug: 'uo' }),
          jsxPlugin({ jsxComponentDescriptors }),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <EmbedSpotifyJSX />
                <InsertFrontmatter />
                <UndoRedo />
              </>
            ),
          }),
        ]}
      />
      <div className="flex flex-row-reverse ">
        <button className="my-2 ">Send It</button>
      </div>
    </section>
  )
}

export default Example
