import { BackIcon } from '@/components/common/icons'
import CustomLink from '@/components/CustomLink'

export default function Collaborate() {
  return (
    <>
      <header>
        <nav className="w-8 h-8 m-3">
          <CustomLink as="/" href="/">
            <BackIcon />
          </CustomLink>
        </nav>
      </header>

      <section className="">
        <div className="max-w-screen-xl px-4 pb-8 mx-auto sm:py-16 lg:px-6">
          <h2 className="mb-8 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Collaborative Content
          </h2>
          <div className="grid pt-8 text-left border-t border-gray-200 md:gap-16 dark:border-gray-700 md:grid-cols-2">
            <div>
              <div className="mb-10">
                <h3 className="flex items-center mb-4 text-lg font-medium text-gray-900 dark:text-white">
                  <svg
                    className="flex-shrink-0 w-5 h-5 mr-2 text-gray-500 dark:text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                  What do you mean by that?
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  You will have access to download the full Figma project including all of the
                  pages, the components, responsive pages, and also the icons, illustrations, and
                  images included in the screens.
                </p>
              </div>
              <div className="mb-10">
                <h3 className="flex items-center mb-4 text-lg font-medium text-gray-900 dark:text-white">
                  <svg
                    className="flex-shrink-0 w-5 h-5 mr-2 text-gray-500 dark:text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                  Conversational tone?
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Once you have purchased either the design, code, or both packages, you will have
                  access to all of the future updates based on the roadmap, free of charge.
                </p>
              </div>
            </div>
            <div>
              <div className="mb-10">
                <h3 className="flex items-center mb-4 text-lg font-medium text-gray-900 dark:text-white">
                  <svg
                    className="flex-shrink-0 w-5 h-5 mr-2 text-gray-500 dark:text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                  What does "free updates" include?
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  The free updates that will be provided is based on the{' '}
                  <a
                    href="#"
                    className="font-medium underline text-primary-600 dark:text-primary-500 hover:no-underline"
                  >
                    roadmap
                  </a>{' '}
                  that we have laid out for this project. It is also possible that we will provide
                  extra updates outside of the roadmap as well.
                </p>
              </div>
              <div className="mb-10">
                <h3 className="flex items-center mb-4 text-lg font-medium text-gray-900 dark:text-white">
                  <svg
                    className="flex-shrink-0 w-5 h-5 mr-2 text-gray-500 dark:text-gray-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                  What does the free version include?
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  The{' '}
                  <a
                    href="#"
                    className="font-medium underline text-primary-600 dark:text-primary-500 hover:no-underline"
                  >
                    free version
                  </a>{' '}
                  of Windster includes a minimal style guidelines, component variants, and a
                  dashboard page with the mobile version alongside it.
                </p>
                <p className="text-gray-500 dark:text-gray-400">
                  You can use this version for any purposes, because it is open-source under the MIT
                  license.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
