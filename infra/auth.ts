// import { bus } from "./events";
// import { database } from "./database";
import { domain } from "./dns"
import { email } from "./email"
import { secret } from "./secret"

if (!domain) throw new Error("no custom domain provided, what you doing blud?")

export const auth = new sst.aws.Auth("Auth", {
  authenticator: {
    // url: true,

    // link: [secret.StripeSecret, secret.NeonDatabaseUrl, database, bus, email],
    link: [email, secret.SquealDBUrl],
    handler: "./packages/functions/src/auth.handler",
  },
})

export const authRouter = new sst.aws.Router("AuthRouter", {
  domain: {
    name: `auth.${domain}`,
    dns: sst.cloudflare.dns(),
  },
  routes: { "/*": auth.url },
})

export const outputs = {
  auth: authRouter.url,
}
