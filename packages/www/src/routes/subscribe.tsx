import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/subscribe")({
  component: Newslater,
})

function Newslater() {
  return (
    <section className="mt-20 mb-8 text-center lg:text-left group">
      <div className="flex flex-wrap justify-center">
        <div className="w-full px-3 grow-0 shrink-0 basis-auto lg:w-10/12">
          <div className="grid items-center lg:grid-cols-2 gap-x-6">
            <div className="mb-10 lg:mb-0">
              <div className="text-2xl font-bold">
                This would be the newsletter section if I actually sent emails
                <br />
                <span className="text-cyan-100">lol</span>
              </div>
            </div>

            <div className="mb-6 md:mb-0">
              <div className="">
                <form
                  action="https://buttondown.email/api/emails/embed-subscribe/goosebumpsfm"
                  method="post"
                  target="popupwindow"
                  onSubmit={async () => {
                    "use server"

                    window.open(
                      "https://buttondown.email/goosebumpsfm",
                      "popupwindow"
                    )
                  }}
                  className="flex-row md:flex"
                >
                  <input
                    type="email"
                    name="email"
                    id="bd-email"
                    className="block w-full px-4 py-2 m-0 mb-2 text-xl font-normal text-gray-700 transition ease-in-out border border-gray-300 border-solid rounded bg-cyan-100 form-control md:mb-0 md:mr-2 bg-clip-padding focus:text-gray-700 focus:bg-bg-cyan-300 focus:border-cyan-600 focus:outline-none"
                    placeholder="Enter your email"
                  />
                  <button
                    type="submit"
                    className="inline-block py-3 text-sm font-medium leading-snug text-white uppercase transition duration-150 ease-in-out rounded shadow-md bg-cyan-600 px-7 hover:bg-cyan-700 hover:shadow-lg focus:bg-cyan-700 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-cyan-800 active:shadow-lg"
                    data-mdb-ripple="true"
                    data-mdb-ripple-color="light"
                  >
                    Subscribe
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
