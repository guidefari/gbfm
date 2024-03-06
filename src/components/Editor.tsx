import '@mdxeditor/editor/style.css'
import {
  MDXEditor,
  UndoRedo,
  BoldItalicUnderlineToggles,
  toolbarPlugin,
  MDXEditorMethods,
  InsertFrontmatter,
  frontmatterPlugin,
  usePublisher,
  insertJsx$,
  JsxComponentDescriptor,
  GenericJsxEditor,
  NestedLexicalEditor,
  jsxPlugin,
} from '@mdxeditor/editor'
import { useRef } from 'react'
import Track from './Track'

// export default function App() {
//   const ref = useRef<MDXEditorMethods>(null)

//   const spotifyTrack = `%3CTrack%20url%3D%22%22%3E`

//   return (
//     <>
//       <button onClick={() => ref.current?.insertMarkdown(spotifyTrack)}>
//         inserting new markdown
//       </button>
//       <MDXEditor
//         ref={ref}
//         markdown="Let me tell you something"
//         plugins={[
//           frontmatterPlugin(),
//           toolbarPlugin({
//             toolbarContents: () => (
//               <>
//                 {' '}
//                 <UndoRedo />
//                 <BoldItalicUnderlineToggles />
//                 <InsertFrontmatter />
//                 {/* <InsertMyLeaf /> */}
//               </>
//             ),
//           }),
//         ]}
//       />
//     </>
//   )
// }

// const InsertMyLeaf = () => {
//   const insertJsx = usePublisher(insertJsx$)
//   return <button onClick={() => insertJsx(<Track url="" />)}>Leaf</button>
// }

const jsxComponentDescriptors: JsxComponentDescriptor[] = [
  {
    name: 'Track',
    kind: 'flow', // 'text' for inline, 'flow' for block
    props: [{ name: 'url', type: 'string' }],
    Editor: GenericJsxEditor,
  },
  {
    name: 'Album',
    kind: 'flow', // 'text' for inline, 'flow' for block
    props: [{ name: 'url', type: 'string' }],
    Editor: GenericJsxEditor,
  },
]

// a toolbar button that will insert a JSX element into the editor.
const InsertMyLeaf = () => {
  const insertJsx = usePublisher(insertJsx$)

  const clickHandler = (name: 'Album' | 'Track') => {
    insertJsx({
      name,
      kind: 'flow',
      props: { url: '' },
    })
  }

  return (
    <>
      <button onClick={() => clickHandler('Track')}>Track</button>
      <button onClick={() => clickHandler('Album')}>Album</button>
    </>
  )
}

const jsxMarkdown = ` ---
slug: hello-world
---

this is a cool markdown
`

export const Example = () => {
  const yo = () => {
    console.log(JSON.stringify(ref?.current?.getMarkdown()))
  }

  const ref = useRef<MDXEditorMethods>(null)

  return (
    <>
      <MDXEditor
        ref={ref}
        markdown={''} // the contents of the file  below
        onChange={() => console.log(ref.current.getMarkdown())}
        plugins={[
          frontmatterPlugin({ slug: 'uo' }),
          jsxPlugin({ jsxComponentDescriptors }),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <InsertMyLeaf />
                <InsertFrontmatter />
              </>
            ),
          }),
        ]}
      />
      <button onClick={yo}>chek</button>
    </>
  )
}

export default Example
