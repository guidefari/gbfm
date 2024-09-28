import { domain } from "./dns"

if (!domain) throw new Error("no custom domain provided")

export const email = new sst.aws.Email("Email", {
  sender: domain,
  dns: sst.cloudflare.dns(),
})
