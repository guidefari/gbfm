import Link from 'src/components/CustomLink'
import { PageSEO } from 'src/components/SEO'
import { SuperHero } from '../components/FrontPage/SuperHero'
import { Content } from '../components/FrontPage/Content'
import Curated from '@/components/curated'
import Image from 'next/image'
import CustomLink from 'src/components/CustomLink'

export default function Index() {
  return (
    <>
      <PageSEO title="goosebumps.fm" description="Curated Music & the occasional prose" />
      <SuperHero />
      <Content />
      <Curated />
      <section className="max-w-2xl mx-auto mt-20">
        <h5>If you've made it this far, well done & thank you</h5>
        <Image
          src={
            'https://res.cloudinary.com/hokaspokas/image/upload/v1687381358/goosebumpsfm/oxi-clean-but-wait-theres-more_mocva1.gif'
          }
          height={400}
          width={400}
          alt={`But wait, there's more!`}
          unoptimized={true}
          className="mx-auto my-16"
        />
        <div className="flex flex-col justify-between p-5 border rounded shadow-sm">
          <div>
            <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-indigo-50">
              <svg
                className="w-12 h-12 text-deep-purple-accent-400"
                stroke="currentColor"
                viewBox="0 0 52 52"
              >
                <polygon
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  points="29 13 14 29 25 29 23 39 38 23 27 23"
                />
              </svg>
            </div>
            <h6 className="mb-2 font-semibold leading-5">
              <CustomLink href="micro" as="micro">
                Micro Posts
              </CustomLink>
            </h6>
            <p className="mb-3 text-sm ">
              Capturing byte-sized ephemeral thoughts. These are sometimes the inspiration to full
              length write ups.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
