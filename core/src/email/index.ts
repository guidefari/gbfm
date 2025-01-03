import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { Resource } from "sst";

export namespace Email {
	export const Client = new SESv2Client({});

	export async function send(
		from: string,
		to: string,
		subject: string,
		body: string,
	) {
		const fromAddress = `${from}@${Resource.Email.sender}`;
		await Client.send(
			new SendEmailCommand({
				Destination: {
					ToAddresses: [to],
				},
				Content: {
					Simple: {
						Body: {
							Text: {
								Data: body,
							},
						},
						Subject: {
							Data: subject,
						},
					},
				},
				FromEmailAddress: `goosebumps.fm <${fromAddress}>`,
			}),
		);
	}
}
