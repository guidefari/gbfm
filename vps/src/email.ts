import { Resend } from "resend";
import { env } from "./env";

type EmailClient = {
    sendEmail: (options: SendEmailOptions) => Promise<void>
}

type SendEmailOptions = {
    to: string | string[]
    from?: string
    subject: string;
    body: string;
}

const resend = new Resend(env.RESEND_API_KEY);

export const client: EmailClient = {
    sendEmail: async (options) => {
        await resend.emails.send({
            from: options.from ?? "Quickbytes dev team <noreply@mail.getquickbytes.com>",
            to: options.to,
            subject: options.subject,
            html: options.body,
        })
    }
}