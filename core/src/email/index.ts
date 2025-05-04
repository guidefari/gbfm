import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { Resource } from "sst";

export namespace Email {
	export const Client = new SESv2Client({});

	export interface Attachment {
		filename: string;
		content: string;
		contentType?: string;
	}

	interface SendEmailProps {
		from: string;
		to: string | string[];
		subject: string;
		body: string;
		attachments?: Attachment[];
	}

	function getToAddresses(to: string | string[]): string[] {
		return Array.isArray(to) ? to : [to];
	}

	function getFromAddress(from: string): string {
		return `${from}@${Resource.Email.sender}`;
	}

	function buildRawMessage({
		from,
		to,
		subject,
		body,
		attachments,
	}: SendEmailProps & { from: string; to: string[] }): string {
		const boundary = `boundary-${Date.now().toString(16)}`;
		let content = [
			`From: goosebumps.fm <${from}>`,
			`To: ${to.join(", ")}`,
			`Subject: ${subject}`,
			"MIME-Version: 1.0",
			`Content-Type: multipart/mixed; boundary="${boundary}"`,
			"",
			`--${boundary}`,
			"Content-Type: text/plain; charset=UTF-8",
			"",
			body,
			"",
		];

		for (const attachment of attachments || []) {
			const contentType =
				attachment.contentType ||
				(attachment.filename.endsWith(".csv")
					? "text/csv"
					: "application/octet-stream");
			content = content.concat([
				`--${boundary}`,
				`Content-Type: ${contentType}; name="${attachment.filename}"`,
				"Content-Transfer-Encoding: base64",
				`Content-Disposition: attachment; filename="${attachment.filename}"`,
				"",
				Buffer.from(attachment.content).toString("base64"),
				"",
			]);
		}

		content.push(`--${boundary}--`);
		return content.join("\r\n");
	}

	export async function send({
		from,
		to,
		subject,
		body,
		attachments,
	}: SendEmailProps): Promise<void> {
		const fromAddress = getFromAddress(from);
		const toAddresses = getToAddresses(to);

		if (attachments && attachments.length > 0) {
			const rawMessage = buildRawMessage({
				from: fromAddress,
				to: toAddresses,
				subject,
				body,
				attachments,
			});

			await Client.send(
				new SendEmailCommand({
					Destination: { ToAddresses: toAddresses },
					FromEmailAddress: `goosebumps.fm <${fromAddress}>`,
					Content: {
						Raw: { Data: Buffer.from(rawMessage) },
					},
				}),
			);
			return;
		}

		await Client.send(
			new SendEmailCommand({
				Destination: { ToAddresses: toAddresses },
				FromEmailAddress: `goosebumps.fm <${fromAddress}>`,
				Content: {
					Simple: {
						Subject: { Data: subject },
						Body: { Text: { Data: body } },
					},
				},
			}),
		);
	}

	// export async function sendRawwrr({
	// 	from,
	// 	to,
	// 	subject,
	// 	body,
	// }: EmailProps) {
	// 	const fromAddress = `${from}@${Resource.Email.sender}`;
	// 	await Client.send(
	// 		new SendEmailCommand({
	// 			Destination: {
	// 				ToAddresses: [to],
	// 			},
	// 			Content: {
	// 				Raw: {
	// 					Data: Buffer.from(body),
	// 				},
	// 			},
	// 			FromEmailAddress: `goosebumps.fm <${fromAddress}>`,
				
	// 		}),
	// 	);
	// }

}
