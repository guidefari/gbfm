import Layout from '../components/Layout'
import { PageSEO } from '@/components/SEO'
import { allLabels, Label } from 'contentlayer/generated'
import Image from 'next/image'

export const getStaticProps = async () => {
  console.log('allLabels:', allLabels)

  return { props: { allLabels } }
}

export default function Index({ allLabels }) {
  console.log('allLabels:', allLabels)

  const noTemplate: Label[] = allLabels.filter(
    (label: Label) => label._id !== 'labels/template-label.mdx'
  )

  return (
    <Layout>
      <PageSEO title="goosebumps.fm/labels" description={'Some record labels we have enjoyed'} />
      <h1 className="title">Record Labels</h1>
      <p>Some record labels myself & friends have enjoyed over the years</p>

      <div className="grid grid-cols-1 gap-4 px-4 my-4 md:grid-cols-3 lg:grid-cols-4">
        {noTemplate.map((label: Label) => (
          <div
            key={label._id}
            className="flex flex-col justify-center bg-white shadow-md rounded-2xl shadow-gray-400/20"
          >
            <Image
              className="object-center w-full aspect-video rounded-t-2xl"
              src={label.thumbnailUrl || ''}
              alt={`Thumbnail image for ${label.name}`}
              width={320}
              height={320}
            />
            <div className="p-3">
              {label.genres
                ? label.genres.map((genre, index) => (
                    <>
                      <small key={`${label.name}-${index}`} className="text-xs text-gray-900">
                        {genre}
                      </small>{' '}
                    </>
                  ))
                : null}
              <h1 className="pb-2 text-2xl font-medium text-gray-700">{label.name}</h1>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
