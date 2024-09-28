import { AuthHandler } from "sst/auth"

import { CodeAdapter } from "sst/auth/adapter"
import { sessions } from "./sessions"
// import { Account } from "@peasy-store/core/account/index";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"
import { Resource } from "sst"
import { handle } from "hono/aws-lambda"
import { z } from "zod"
import { User } from "@gbfm/core/user/index.ts"
// import { Account } from "@gbfm/core/db/models/account/index.ts"
// import { withActor } from "@peasy-store/core/actor";

const ses = new SESv2Client({})

const claimsSchema = z.object({
  email: z
    .string()
    .min(1, "Please enter your email")
    .email("The email you entered is invalid"),
})

const app = AuthHandler({
  session: sessions,
  providers: {
    code: CodeAdapter({
      async onCodeRequest(code, unvalidatedClaims, req) {
        const referrer = req.headers.get("referer")
        const claims = claimsSchema.parse(unvalidatedClaims)
        console.log({ code })

        console.log("Resource.Email:", Resource.Email)
        const from = Resource.Email.sender.includes("@")
          ? `gbfm <${Resource.Email.sender}>`
          : `gbfm auth@${Resource.Email.sender}`
        console.log("from:", from)

        const cmd = new SendEmailCommand({
          Destination: { ToAddresses: [claims.email] },
          FromEmailAddress: from,
          Content: {
            Simple: {
              Body: {
                Html: { Data: `Your pin code is <strong>${code}</strong>` },
                Text: { Data: `Your pin code is ${code}` },
              },
              Subject: { Data: `Goosebumps fm code: ${code}` },
            },
          },
        })
        await ses.send(cmd)

        return new Response("ok", {
          status: 302,
          headers: {
            location: `${referrer}auth/verify?email=${claims.email}`,
          },
        })
      },
      async onCodeInvalid(_code, _claims, req) {
        const referrer = req.headers.get("referer")
        return new Response("ok", {
          status: 302,
          headers: {
            location: `${referrer}auth/verify?error=invalid_code`,
          },
        })
      },
    }),
  },
  callbacks: {
    auth: {
      async allowClient(_clientID, _redirect) {
        return true
      },
      async success(ctx, input) {
        console.log(input)
        if (input.provider === "code") {
          const email = input.claims.email.toLowerCase()
          let account = await User.fromEmail(email)
          if (!account) {
            const accountID = await User.create(email)
            account = {
              id: accountID,
              email,
            }
          }
          return ctx.session({
            type: "account",
            properties: {
              accountID: account.id,
              email: account.email,
            },
          })
        }

        return new Response("Not Supported", {
          status: 400,
          headers: { "content-type": "text/plain" },
        })
      },
    },
  },
})

export const handler = handle(app)
